package com.syncstream.backend.websocket;

import lombok.Getter;
import lombok.Setter;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class TerminalSessionManager {

  @Getter
  public static class TerminalSession {

    private final String clientId;

    private final String room;

    private final String username;

    @Setter
    private WebSocketSession socket;

    TerminalSession(
      String clientId,
      String room,
      String username,
      WebSocketSession socket
    ) {
      this.clientId = clientId;
      this.room = room;
      this.username = username;
      this.socket = socket;
    }

  }

  private final Map<String, TerminalSession> sessions =
    new ConcurrentHashMap<>();

  public void createSession(
    String clientId,
    String room,
    String username,
    WebSocketSession socket
  ) {

    sessions.put(
      clientId,
      new TerminalSession(
        clientId,
        room,
        username,
        socket
      )
    );
  }

  public TerminalSession getSession(
    String clientId
  ) {
    return sessions.get(clientId);
  }

  public void reconnectSession(
    String clientId,
    WebSocketSession socket
  ) {

    TerminalSession session =
      sessions.get(clientId);

    if (session != null) {
      session.setSocket(socket);
    }
  }

  public void removeSession(
    String clientId
  ) {
    sessions.remove(clientId);
  }

  public boolean hasSession(
    String clientId
  ) {
    return sessions.containsKey(clientId);
  }

  public int getSessionCount() {
    return sessions.size();
  }
}
