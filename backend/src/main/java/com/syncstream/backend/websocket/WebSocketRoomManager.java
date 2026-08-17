package com.syncstream.backend.websocket;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import com.syncstream.backend.services.RoomPersistenceService;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class WebSocketRoomManager {

  private static final int COMPACTION_THRESHOLD = 100;

  private final Map<String, Set<WebSocketSession>> rooms =
    new ConcurrentHashMap<>();

  private final Map<String, Map<String, String>> roomUsers =
    new ConcurrentHashMap<>();

  private final RoomPersistenceService persistenceService;

  /*
   * represents one persisted Yjs update currently
   * kept in server memory for quick access.
   */
  private record RoomUpdateState(
    long id,
    byte[] data
  ) {}

  /*
   * represents the complete in-memory state of a room.
   *
   * the snapshot is kept seperately from normal
   * updates because it represents a compacted state.
   */
  private static class RoomState {

    private byte[] snapshotData;

    private long snapshotUpdateId;

    private final List<RoomUpdateState> updates =
      new ArrayList<>();
  }

  private final Map<String, RoomState> roomStates =
    new ConcurrentHashMap<>();

  public WebSocketRoomManager(
    RoomPersistenceService persistenceService
  ) {
    this.persistenceService = persistenceService;
  }

  private RoomState loadRoomState(
    String room
  ) {
    RoomState existing =
      roomStates.get(room);

    if (existing != null) {
      return existing;
    }

    synchronized (roomStates) {
      existing =
        roomStates.get(room);

      if (existing != null) {
        return existing;
      }

      // loads the persisted state when a room enters server memory
      RoomPersistenceService.RecoveryState recovery =
        persistenceService.loadRecoveryState(room);

      RoomState state =
        new RoomState();

      if (recovery.snapshotData() != null) {
        state.snapshotData =
          recovery.snapshotData().clone();

        state.snapshotUpdateId =
          recovery.snapshotUpdateId();
      }

      for (
        var update :
        recovery.updates()
      ) {
        state.updates.add(
          new RoomUpdateState(
            update.getId(),
            update.getUpdateData()
          )
        );
      }

      roomStates.put(
        room,
        state
      );

      return state;
    }
  }

  public WebSocketSession addToRoom(
    String room,
    WebSocketSession session
  ) {
    // loads the room before adding the first active session
    loadRoomState(room);

    // protects sends from being blocked by a slow websocket client
    WebSocketSession decoratedSession =
      new ConcurrentWebSocketSessionDecorator(
        session,
        10_000,
        512 * 1024
      );

    rooms
      .computeIfAbsent(
        room,
        key -> ConcurrentHashMap.newKeySet()
      )
      .add(decoratedSession);

    return decoratedSession;
  }

  public void removeFromRoom(
    String room,
    String sessionId
  ) {
    Set<WebSocketSession> sessions =
      rooms.get(room);

    if (sessions != null) {
      sessions.removeIf(
        session -> session.getId().equals(sessionId)
      );

      if (sessions.isEmpty()) {
        rooms.remove(room);
      }
    }
  }

  public Set<WebSocketSession> getRoomSessions(
    String room
  ) {
    return rooms.getOrDefault(
      room,
      Set.of()
    );
  }

  public boolean isCurrentSession(
    String room,
    String clientId,
    String sessionId
  ) {
    WebSocketSession session =
      getSessionByClientId(
        room,
        clientId
      );

    return session != null &&
      session.getId().equals(sessionId);
  }

  public WebSocketSession getSessionByClientId(
    String room,
    String clientId
  ) {
    for (
      WebSocketSession session :
      getRoomSessions(room)
    ) {
      String sessionClientId =
        (String) session
          .getAttributes()
          .get("clientId");

      if (clientId.equals(sessionClientId)) {
        return session;
      }
    }

    return null;
  }

  public void addUser(
    String room,
    String clientId,
    String username
  ) {
    roomUsers
      .computeIfAbsent(
        room,
        key -> new ConcurrentHashMap<>()
      )
      .put(
        clientId,
        username
      );
  }

  public void removeUser(
    String room,
    String clientId
  ) {
    Map<String, String> users =
      roomUsers.get(room);

    if (users != null) {
      users.remove(clientId);

      if (users.isEmpty()) {
        roomUsers.remove(room);
      }
    }
  }

  public Map<String, String> getRoomUsers(
    String room
  ) {
    return roomUsers.getOrDefault(
      room,
      Map.of()
    );
  }

  /*
   * stores a Yjs update in both the database and memory.
   */
  public long addRoomUpdate(
    String room,
    byte[] update
  ) {
    RoomState state =
      loadRoomState(room);

    /*
     * persists first because the database generates
     * the update id for us.
     */
    long updateId =
      persistenceService.saveUpdate(
        room,
        update
      );

    synchronized (state.updates) {
      state.updates.add(
        new RoomUpdateState(
          updateId,
          update.clone()
        )
      );
    }

    return updateId;
  }

  /*
   * returns the current room state as Yjs updates.
   *
   * the snapshot comes first, followed by updates that
   * happened after that snapshot was created.
   */
  public List<byte[]> getRoomUpdates(
    String room
  ) {
    RoomState state =
      loadRoomState(room);

    synchronized (state.updates) {
      List<byte[]> result =
        new ArrayList<>();

      if (state.snapshotData != null) {
        byte[] snapshot =
          state.snapshotData;

        byte[] snapshotMessage =
          new byte[
            1 + snapshot.length
            ];

        snapshotMessage[0] = 0;

        System.arraycopy(
          snapshot,
          0,
          snapshotMessage,
          1,
          snapshot.length
        );

        result.add(
          snapshotMessage
        );
      }

      for (
        RoomUpdateState update :
        state.updates
      ) {
        result.add(
          update.data().clone()
        );
      }

      return result;
    }
  }

  /*
   * checks whether enough updates have accumulated
   * since the current snapshot.
   */
  public boolean shouldCompact(
    String room
  ) {
    RoomState state =
      loadRoomState(room);

    synchronized (state.updates) {
      return state.updates.size() >=
        COMPACTION_THRESHOLD;
    }
  }

  /*
   * replaces the current in-memory snapshot and removes
   * updates that are already covered by that snapshot.
   */
  public void applySnapshot(
    String room,
    byte[] snapshotData,
    long snapshotUpdateId
  ) {
    RoomState state =
      loadRoomState(room);

    synchronized (state.updates) {

      state.snapshotData =
        snapshotData.clone();

      state.snapshotUpdateId =
        snapshotUpdateId;

      state.updates.removeIf(
        update ->
          update.id() <= snapshotUpdateId
      );
    }
  }
}
