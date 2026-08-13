package com.codemesh.backend.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.BinaryWebSocketHandler;

import java.nio.charset.StandardCharsets;
import java.util.Map;

@Component
public class CodeWebSocketHandler extends BinaryWebSocketHandler {

  private static final Logger logger =
    LoggerFactory.getLogger(CodeWebSocketHandler.class);

  private static final int MESSAGE_UPDATE = 0;
  private static final int MESSAGE_SYNC_REQUEST = 1;
  private static final int MESSAGE_SYNC_RESPONSE = 2;
  private static final int MESSAGE_PRESENCE = 3;

  private final WebSocketRoomManager roomManager;
  private final ObjectMapper objectMapper = new ObjectMapper();

  public CodeWebSocketHandler(WebSocketRoomManager roomManager) {
    this.roomManager = roomManager;
  }

  @Override
  public void afterConnectionEstablished(WebSocketSession session) {
    String room = (String) session.getAttributes().get("room");

    roomManager.addToRoom(room, session);

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
    String room = (String) session.getAttributes().get("room");

    byte[] data = new byte[message.getPayload().remaining()];
    message.getPayload().get(data);

    if (data.length == 0) {
      logger.warn("Received empty binary message");
      return;
    }

    int messageType = data[0];

    if (messageType == MESSAGE_UPDATE) {
      broadcastUpdate(room, session, data);
      return;
    }

    if (messageType == MESSAGE_SYNC_REQUEST) {
      broadcastSyncRequest(room, session, data);
      return;
    }

    if (messageType == MESSAGE_SYNC_RESPONSE) {
      sendSyncResponse(room, data);
      return;
    }

    if (messageType == MESSAGE_PRESENCE) {
      handlePresence(room, session, data);
      return;
    }

    logger.warn("Unknown WebSocket message type: {}", messageType);
  }

  @Override
  public void afterConnectionClosed(
    WebSocketSession session,
    org.springframework.web.socket.CloseStatus status
  ) {
    String room =
      (String) session.getAttributes().get("room");

    String clientId =
      (String) session.getAttributes().get("clientId");

    roomManager.removeFromRoom(
      room,
      session.getId()
    );

    if (clientId != null) {
      roomManager.removeUser(room, clientId);

      try {
        Map<String, String> presence = Map.of(
          "action", "leave",
          "clientId", clientId
        );

        byte[] message = createPresenceMessage(presence);

        broadcastPresence(room, message);
      } catch (Exception e) {
        logger.error("Failed to broadcast user leave", e);
      }
    }

    logger.info(
      "WebSocket disconnected: {} left room {}",
      session.getId(),
      room
    );
  }

  private void broadcastUpdate(
    String room,
    WebSocketSession sender,
    byte[] data
  ) {
    for (WebSocketSession client : roomManager.getRoomSessions(room)) {
      if (client.isOpen() && !client.getId().equals(sender.getId())) {
        try {
          client.sendMessage(new BinaryMessage(data));
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

  private void broadcastSyncRequest(
    String room,
    WebSocketSession sender,
    byte[] data
  ) {
    for (WebSocketSession client : roomManager.getRoomSessions(room)) {
      if (client.isOpen() && !client.getId().equals(sender.getId())) {
        try {
          client.sendMessage(new BinaryMessage(data));
        } catch (Exception e) {
          logger.error(
            "Failed to send sync request to client {}",
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
      logger.warn("Invalid sync response received");
      return;
    }

    String targetClientId = new String(
      data,
      1,
      36,
      StandardCharsets.UTF_8
    );

    WebSocketSession target =
      roomManager.getSessionByClientId(room, targetClientId);

    if (target == null || !target.isOpen()) {
      logger.warn(
        "Sync target not found: {}",
        targetClientId
      );
      return;
    }

    try {
      target.sendMessage(new BinaryMessage(data));
    } catch (Exception e) {
      logger.error(
        "Failed to send sync response to client {}",
        target.getId(),
        e
      );
    }
  }

  private void handlePresence(
    String room,
    WebSocketSession session,
    byte[] data
  ) {
    try {
      String json = new String(
        data,
        1,
        data.length - 1,
        StandardCharsets.UTF_8
      );

      Map<String, Object> presence =
        objectMapper.readValue(json, Map.class);

      String action = (String) presence.get("action");
      String clientId = (String) presence.get("clientId");

      String sessionClientId =
        (String) session.getAttributes().get("clientId");

      if (clientId == null || !clientId.equals(sessionClientId)) {
        logger.warn("Invalid presence clientId");
        return;
      }

      if ("join".equals(action)) {
        String username = (String) presence.get("username");

        if (username == null || username.isBlank()) {
          logger.warn("Invalid username in presence message");
          return;
        }

        roomManager.addUser(
          room,
          clientId,
          username
        );

        broadcastPresence(room, data);

        sendCurrentUsers(room, session);
      }

      if ("cursor".equals(action)) {
        broadcastPresence(room, data);
      }

    } catch (Exception e) {
      logger.error("Failed to handle presence message", e);
    }
  }

  private void sendCurrentUsers(
    String room,
    WebSocketSession session
  ) {
    try {
      Map<String, Object> presence = Map.of(
        "action", "state",
        "users", roomManager.getRoomUsers(room)
      );

      byte[] message =
        createPresenceMessage(presence);

      WebSocketSession managedSession =
        roomManager.getSessionByClientId(
          room,
          (String) session.getAttributes().get("clientId")
        );

      if (
        managedSession != null &&
          managedSession.isOpen()
      ) {
        managedSession.sendMessage(
          new BinaryMessage(message)
        );
      }

    } catch (Exception e) {
      logger.error(
        "Failed to send current users to client {}",
        session.getId(),
        e
      );
    }
  }

  private void broadcastPresence(
    String room,
    byte[] data
  ) {
    for (WebSocketSession client :
      roomManager.getRoomSessions(room)) {

      if (client.isOpen()) {
        try {
          client.sendMessage(new BinaryMessage(data));
        } catch (Exception e) {
          logger.error(
            "Failed to send presence update to client {}",
            client.getId(),
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
        .writeValueAsString(presence)
        .getBytes(StandardCharsets.UTF_8);

    byte[] message = new byte[1 + jsonBytes.length];

    message[0] = MESSAGE_PRESENCE;

    System.arraycopy(
      jsonBytes,
      0,
      message,
      1,
      jsonBytes.length
    );

    return message;
  }
}
