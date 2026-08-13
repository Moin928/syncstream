package com.codemesh.backend.websocket;

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
    String query = request.getURI().getQuery();

    if (query == null) {
      return false;
    }

    String room = null;
    String clientId = null;

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
