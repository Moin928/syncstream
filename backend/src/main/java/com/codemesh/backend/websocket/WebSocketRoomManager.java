package com.codemesh.backend.websocket;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class WebSocketRoomManager {

  private final Map<String, Set<WebSocketSession>> rooms =
    new ConcurrentHashMap<>();

  private final Map<String, Map<String, String>> roomUsers =
    new ConcurrentHashMap<>();

  public WebSocketSession addToRoom(
    String room,
    WebSocketSession session
  ) {
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
    return rooms.getOrDefault(room, Set.of());
  }

  public WebSocketSession getSessionByClientId(
    String room,
    String clientId
  ) {
    for (WebSocketSession session :
      getRoomSessions(room)) {

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
      .put(clientId, username);
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
}
