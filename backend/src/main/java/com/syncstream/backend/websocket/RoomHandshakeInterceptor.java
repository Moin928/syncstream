package com.syncstream.backend.websocket;

import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;

public class RoomHandshakeInterceptor implements HandshakeInterceptor {

  @Override
  public boolean beforeHandshake(
    ServerHttpRequest request,
    ServerHttpResponse response,
    WebSocketHandler wsHandler,
    Map<String, Object> attributes
  ) {
    // gets the query parameters from the websocket connection request
    String query = request.getURI().getQuery();

    if (query == null) {
      return false;
    }

    String room = null;
    String clientId = null;

    // reads the room and client id from the connection parameters
    for (String parameter : query.split("&")) {
      String[] parts = parameter.split("=", 2);

      if (parts.length != 2) {
        continue;
      }

      if (parts[0].equals("room")) {
        room = parts[1];
      }

      if (parts[0].equals("clientId")) {
        clientId = parts[1];
      }
    }

    if (room == null || room.isBlank()) {
      return false;
    }

    if (clientId == null || clientId.isBlank()) {
      return false;
    }

    // stores the connection details so the websocket handler can use them later
    attributes.put("room", room);
    attributes.put("clientId", clientId);

    return true;
  }

  @Override
  public void afterHandshake(
    ServerHttpRequest request,
    ServerHttpResponse response,
    WebSocketHandler wsHandler,
    Exception exception
  ) {
  }
}
