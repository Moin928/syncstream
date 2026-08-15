package com.syncstream.backend.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.syncstream.backend.services.RoomPersistenceService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.BinaryWebSocketHandler;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@Component
public class CodeWebSocketHandler
  extends BinaryWebSocketHandler {

  private static final Logger logger =
    LoggerFactory.getLogger(
      CodeWebSocketHandler.class
    );

  private static final int MESSAGE_UPDATE = 0;
  private static final int MESSAGE_SYNC_REQUEST = 1;
  private static final int MESSAGE_SYNC_RESPONSE = 2;
  private static final int MESSAGE_PRESENCE = 3;
  private static final int MESSAGE_SYNC_COMPLETE = 4;
  private static final int MESSAGE_SNAPSHOT_REQUEST = 5;
  private static final int MESSAGE_SNAPSHOT_RESPONSE = 6;

  private final WebSocketRoomManager roomManager;
  private final RoomPersistenceService persistenceService;

  private final ObjectMapper objectMapper =
    new ObjectMapper();

  public CodeWebSocketHandler(
    WebSocketRoomManager roomManager,
    RoomPersistenceService persistenceService
  ) {
    this.roomManager = roomManager;
    this.persistenceService = persistenceService;
  }

  @Override
  public void afterConnectionEstablished(
    WebSocketSession session
  ) {
    String room =
      (String) session
        .getAttributes()
        .get("room");

    roomManager.addToRoom(
      room,
      session
    );

    logger.info(
      "WebSocket connected: {} joined room: {}",
      session.getId(),
      room
    );
  }

  @Override
  protected void handleBinaryMessage(
    WebSocketSession session,
    BinaryMessage message
  ) {
    String room =
      (String) session
        .getAttributes()
        .get("room");

    byte[] data =
      new byte[
        message.getPayload().remaining()
        ];

    message.getPayload().get(data);

    if (data.length == 0) {
      logger.warn(
        "Received empty binary message"
      );

      return;
    }

    int messageType =
      data[0];

    if (
      messageType ==
        MESSAGE_UPDATE
    ) {
      handleUpdate(
        room,
        session,
        data
      );

      return;
    }

    if (
      messageType ==
        MESSAGE_SYNC_REQUEST
    ) {
      handleSyncRequest(
        room,
        session,
        data
      );

      return;
    }

    if (
      messageType ==
        MESSAGE_SYNC_RESPONSE
    ) {
      sendSyncResponse(
        room,
        data
      );

      return;
    }

    if (
      messageType ==
        MESSAGE_PRESENCE
    ) {
      handlePresence(
        room,
        session,
        data
      );

      return;
    }

    if (
      messageType ==
        MESSAGE_SNAPSHOT_REQUEST
    ) {
      handleSnapshotRequest(
        room,
        session
      );

      return;
    }

    if (
      messageType ==
        MESSAGE_SNAPSHOT_RESPONSE
    ) {
      handleSnapshotResponse(
        room,
        data
      );

      return;
    }

    logger.warn(
      "Unknown WebSocket message type: {}",
      messageType
    );
  }

  private void handleUpdate(
    String room,
    WebSocketSession sender,
    byte[] data
  ) {
    roomManager.addRoomUpdate(
      room,
      data
    );

    broadcastUpdate(
      room,
      sender,
      data
    );

    if (
      roomManager.shouldCompact(room)
    ) {
      WebSocketSession snapshotSession =
        getSnapshotSession(room);

      if (snapshotSession != null) {
        handleSnapshotRequest(
          room,
          snapshotSession
        );
      }
    }
  }

  private void handleSyncRequest(
    String room,
    WebSocketSession requester,
    byte[] data
  ) {
    if (data.length < 37) {
      logger.warn(
        "Invalid sync request received"
      );

      return;
    }

    String targetClientId =
      new String(
        data,
        1,
        36,
        StandardCharsets.UTF_8
      );

    /*
     * only the requesting client should receive the sync.
     */
    String requesterClientId =
      (String) requester
        .getAttributes()
        .get("clientId");

    if (
      !targetClientId.equals(
        requesterClientId
      )
    ) {
      logger.warn(
        "Sync request clientId mismatch"
      );

      return;
    }

    List<byte[]> updates =
      roomManager.getRoomUpdates(
        room
      );

    /*
     * replay the stored room state.
     */
    for (byte[] update : updates) {
      try {
        requester.sendMessage(
          new BinaryMessage(update)
        );
      } catch (Exception e) {
        logger.error(
          "Failed to send stored update to {}",
          requester.getId(),
          e
        );

        return;
      }
    }

    byte[] complete =
      new byte[1 + 36];

    complete[0] =
      MESSAGE_SYNC_COMPLETE;

    byte[] clientIdBytes =
      targetClientId.getBytes(
        StandardCharsets.UTF_8
      );

    System.arraycopy(
      clientIdBytes,
      0,
      complete,
      1,
      36
    );

    try {
      requester.sendMessage(
        new BinaryMessage(complete)
      );
    } catch (Exception e) {
      logger.error(
        "Failed to send sync completion",
        e
      );
    }
  }

  private void broadcastUpdate(
    String room,
    WebSocketSession sender,
    byte[] data
  ) {
    for (
      WebSocketSession client :
      roomManager.getRoomSessions(room)
    ) {
      if (
        client.isOpen() &&
          !client.getId().equals(
            sender.getId()
          )
      ) {
        try {
          client.sendMessage(
            new BinaryMessage(data)
          );
        } catch (Exception e) {
          logger.error(
            "Failed to send update to client {}",
            client.getId(),
            e
          );
        }
      }
    }
  }

  private void sendSyncResponse(
    String room,
    byte[] data
  ) {
    if (data.length < 37) {
      logger.warn(
        "Invalid sync response received"
      );

      return;
    }

    String targetClientId =
      new String(
        data,
        1,
        36,
        StandardCharsets.UTF_8
      );

    WebSocketSession target =
      roomManager.getSessionByClientId(
        room,
        targetClientId
      );

    if (
      target == null ||
        !target.isOpen()
    ) {
      logger.warn(
        "Sync target not found: {}",
        targetClientId
      );

      return;
    }

    try {
      target.sendMessage(
        new BinaryMessage(data)
      );
    } catch (Exception e) {
      logger.error(
        "Failed to send sync response",
        e
      );
    }
  }

  @Override
  public void afterConnectionClosed(
    WebSocketSession session,
    CloseStatus status
  ) {
    String room =
      (String) session
        .getAttributes()
        .get("room");

    String clientId =
      (String) session
        .getAttributes()
        .get("clientId");

    boolean wasCurrentSession =
      clientId != null &&
        roomManager.isCurrentSession(
          room,
          clientId,
          session.getId()
        );

    roomManager.removeFromRoom(
      room,
      session.getId()
    );

    if (
      clientId != null &&
        wasCurrentSession
    ) {
      roomManager.removeUser(
        room,
        clientId
      );

      try {
        Map<String, String> presence =
          Map.of(
            "action",
            "leave",
            "clientId",
            clientId
          );

        byte[] message =
          createPresenceMessage(
            presence
          );

        broadcastPresence(
          room,
          message
        );

      } catch (Exception e) {
        logger.error(
          "Failed to broadcast user leave",
          e
        );
      }
    }

    logger.info(
      "WebSocket disconnected: {} left room {}",
      session.getId(),
      room
    );
  }

  private void handlePresence(
    String room,
    WebSocketSession session,
    byte[] data
  ) {
    try {
      String json =
        new String(
          data,
          1,
          data.length - 1,
          StandardCharsets.UTF_8
        );

      Map<String, Object> presence =
        objectMapper.readValue(
          json,
          Map.class
        );

      String action =
        (String) presence.get(
          "action"
        );

      String clientId =
        (String) presence.get(
          "clientId"
        );

      String sessionClientId =
        (String) session
          .getAttributes()
          .get("clientId");

      if (
        clientId == null ||
          !clientId.equals(
            sessionClientId
          )
      ) {
        logger.warn(
          "Invalid presence clientId"
        );

        return;
      }

      if (
        "join".equals(action)
      ) {
        String username =
          (String) presence.get(
            "username"
          );

        if (
          username == null ||
            username.isBlank()
        ) {
          logger.warn(
            "Invalid username"
          );

          return;
        }

        roomManager.addUser(
          room,
          clientId,
          username
        );

        broadcastPresence(
          room,
          data
        );

        sendCurrentUsers(
          room,
          session
        );
      }

      if (
        "cursor".equals(action) ||
          "selection".equals(action)
      ) {
        broadcastPresence(
          room,
          data
        );
      }

    } catch (Exception e) {
      logger.error(
        "Failed to handle presence message",
        e
      );
    }
  }

  private void sendCurrentUsers(
    String room,
    WebSocketSession session
  ) {
    try {
      Map<String, Object> presence =
        Map.of(
          "action",
          "state",
          "users",
          roomManager.getRoomUsers(
            room
          )
        );

      byte[] message =
        createPresenceMessage(
          presence
        );

      session.sendMessage(
        new BinaryMessage(message)
      );

    } catch (Exception e) {
      logger.error(
        "Failed to send current users",
        e
      );
    }
  }

  private void broadcastPresence(
    String room,
    byte[] data
  ) {
    for (
      WebSocketSession client :
      roomManager.getRoomSessions(room)
    ) {
      if (client.isOpen()) {
        try {
          client.sendMessage(
            new BinaryMessage(data)
          );
        } catch (Exception e) {
          logger.error(
            "Failed to send presence update",
            e
          );
        }
      }
    }
  }

  private byte[] createPresenceMessage(
    Map<String, ?> presence
  ) throws Exception {
    byte[] jsonBytes =
      objectMapper
        .writeValueAsString(
          presence
        )
        .getBytes(
          StandardCharsets.UTF_8
        );

    byte[] message =
      new byte[
        1 + jsonBytes.length
        ];

    message[0] =
      MESSAGE_PRESENCE;

    System.arraycopy(
      jsonBytes,
      0,
      message,
      1,
      jsonBytes.length
    );

    return message;
  }

  private void handleSnapshotRequest(
    String room,
    WebSocketSession requester
  ) {
    long snapshotUpdateId =
      persistenceService.getLatestUpdateId(
        room
      );

    byte[] message =
      new byte[
        1 + Long.BYTES
        ];

    message[0] =
      MESSAGE_SNAPSHOT_REQUEST;

    java.nio.ByteBuffer
      .wrap(
        message,
        1,
        Long.BYTES
      )
      .putLong(
        snapshotUpdateId
      );

    try {
      requester.sendMessage(
        new BinaryMessage(message)
      );

      logger.info(
        "Snapshot request sent for room: {} with barrier: {}",
        room,
        snapshotUpdateId
      );

    } catch (Exception e) {
      logger.error(
        "Failed to send snapshot request",
        e
      );
    }
  }

  private void handleSnapshotResponse(
    String room,
    byte[] data
  ) {
    if (
      data.length <
        1 + Long.BYTES
    ) {
      logger.warn(
        "Invalid snapshot response received"
      );

      return;
    }

    long snapshotUpdateId =
      java.nio.ByteBuffer
        .wrap(
          data,
          1,
          Long.BYTES
        )
        .getLong();

    int snapshotStart =
      1 + Long.BYTES;

    byte[] snapshotData =
      new byte[
        data.length - snapshotStart
        ];

    System.arraycopy(
      data,
      snapshotStart,
      snapshotData,
      0,
      snapshotData.length
    );

    if (snapshotData.length == 0) {
      logger.warn(
        "Received empty snapshot for room: {}",
        room
      );

      return;
    }

    persistenceService.saveSnapshot(
      room,
      snapshotData,
      snapshotUpdateId
    );

    roomManager.applySnapshot(
      room,
      snapshotData,
      snapshotUpdateId
    );

    logger.info(
      "Snapshot saved for room: {} at update ID: {}",
      room,
      snapshotUpdateId
    );
  }

  private WebSocketSession getSnapshotSession(
    String room
  ) {
    for (
      WebSocketSession session :
      roomManager.getRoomSessions(room)
    ) {
      if (session.isOpen()) {
        return session;
      }
    }

    return null;
  }
}

