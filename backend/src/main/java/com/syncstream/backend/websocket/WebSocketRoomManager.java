package com.syncstream.backend.websocket;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import com.syncstream.backend.services.RoomPersistenceService;

import java.util.Collections;
import java.util.concurrent.atomic.AtomicLong;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class WebSocketRoomManager {

  private final Map<String, Set<WebSocketSession>> rooms =
    new ConcurrentHashMap<>();

  private final Map<String, Map<String, String>> roomUsers =
    new ConcurrentHashMap<>();

  private final RoomPersistenceService persistenceService;

  private final Map<String, AtomicLong> roomSequences =
    new ConcurrentHashMap<>();

  /*
   * Stores Yjs updates for each room.
   *
   * The server does not need to understand Yjs hehehe.
   * Yjs updates are kept as opaque byte arrays.
   */
  private final Map<String, List<byte[]>> roomUpdates =
    new ConcurrentHashMap<>();

  public WebSocketRoomManager(
    RoomPersistenceService persistenceService
  ) {
    this.persistenceService = persistenceService;
  }

  private void loadRoomState(String room) {
    if (roomUpdates.containsKey(room)) {
      return;
    }

    synchronized (roomUpdates) {
      if (roomUpdates.containsKey(room)) {
        return;
      }

      List<byte[]> persistedUpdates =
        persistenceService.loadUpdates(room);

      List<byte[]> updates =
        Collections.synchronizedList(
          new ArrayList<>()
        );

      for (byte[] update : persistedUpdates) {
        updates.add(update.clone());
      }

      roomUpdates.put(room, updates);

      roomSequences.put(
        room,
        new AtomicLong(updates.size())
      );
    }
  }

  public WebSocketSession addToRoom(
    String room,
    WebSocketSession session
  ) {
    loadRoomState(room);

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
   * Store a Yjs update.
   */
  public void addRoomUpdate(
    String room,
    byte[] update
  ) {
    loadRoomState(room);

    long sequence =
      roomSequences
        .get(room)
        .incrementAndGet();

    List<byte[]> updates =
      roomUpdates.get(room);

    synchronized (updates) {
      updates.add(update.clone());
    }

    persistenceService.saveUpdate(
      room,
      update,
      sequence
    );
  }

  /*
   * Return a snapshot of all known updates.
   */
  public List<byte[]> getRoomUpdates(
    String room
  ) {
    List<byte[]> updates =
      roomUpdates.get(room);

    if (updates == null) {
      return List.of();
    }

    synchronized (updates) {
      List<byte[]> copy =
        new ArrayList<>(
          updates.size()
        );

      for (byte[] update : updates) {
        copy.add(update.clone());
      }

      return copy;
    }
  }
}
