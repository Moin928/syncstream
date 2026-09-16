package com.syncstream.backend.websocket;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.syncstream.backend.services.TerminalExecutionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;

@Component
public class TerminalWebSocketHandler
  extends TextWebSocketHandler {

  private static final Logger logger =
    LoggerFactory.getLogger(TerminalWebSocketHandler.class);

  private final WebSocketRoomManager roomManager;
  private final TerminalSessionManager sessionManager;
  private final TerminalExecutionService executionService;
  private final ObjectMapper objectMapper = new ObjectMapper();

  public TerminalWebSocketHandler(
    WebSocketRoomManager roomManager,
    TerminalSessionManager sessionManager,
    TerminalExecutionService executionService
  ) {
    this.roomManager = roomManager;
    this.sessionManager = sessionManager;
    this.executionService = executionService;
  }

  @Override
  public void afterConnectionEstablished(
    WebSocketSession session
  ) throws Exception {

    String room = getQueryParameter(session, "room");
    String username = getQueryParameter(session, "username");
    String clientId = getQueryParameter(session, "clientId");

    if (
      room == null || room.isBlank() ||
      username == null || username.isBlank() ||
      clientId == null || clientId.isBlank()
    ) {
      send(session, "\r\nInvalid terminal session.\r\n");
      session.close(CloseStatus.BAD_DATA);
      return;
    }

    session.getAttributes().put("room", room);
    session.getAttributes().put("username", username);
    session.getAttributes().put("clientId", clientId);

    sessionManager.createSession(
      clientId,
      room,
      username,
      session
    );

    logger.info(
      "Terminal connected: session={} clientId={} user={} room={}",
      session.getId(),
      clientId,
      username,
      room
    );

    send(
      session,
      "\u001B[32mSyncStream Collaborative Terminal\u001B[0m\r\n"
        + "Connected as \u001B[33m" + username + "\u001B[0m in room \u001B[34m" + room + "\u001B[0m\r\n"
        + "Type \u001B[36m'help'\u001B[0m for available commands, or click \u001B[32m'▶ Run'\u001B[0m above to execute.\r\n\r\n$ "
    );
  }

  @Override
  protected void handleTextMessage(
    WebSocketSession session,
    TextMessage message
  ) throws Exception {

    String rawPayload = message.getPayload().trim();
    String clientId = (String) session.getAttributes().get("clientId");

    if (clientId == null || !sessionManager.hasSession(clientId)) {
      send(session, "\r\nTerminal session unavailable.\r\n");
      return;
    }

    if (rawPayload.isEmpty()) {
      send(session, "$ ");
      return;
    }

    // Ctrl+C interrupt
    if (rawPayload.equals("\u0003")) {
      executionService.interrupt(clientId);
      return;
    }

    // Check if JSON execution payload from Run Code button
    if (rawPayload.startsWith("{") && rawPayload.endsWith("}")) {
      try {
        JsonNode jsonNode = objectMapper.readTree(rawPayload);
        if (jsonNode.has("type") && "run".equals(jsonNode.get("type").asText())) {
          String language = jsonNode.has("language") ? jsonNode.get("language").asText() : "javascript";
          String code = jsonNode.has("code") ? jsonNode.get("code").asText() : "";
          executionService.executeCode(clientId, language, code);
          return;
        }
      } catch (Exception ignored) {
        // Not a valid JSON payload, treat as normal shell command
      }
    }

    String command = rawPayload;
    logger.info("Terminal command from clientId={}: {}", clientId, command);

    /*
     * Commands that don't need an OS process.
     */
    switch (command) {
      case "help":
        send(
          session,
          "\r\n\u001B[36mAvailable commands:\u001B[0m\r\n"
            + "  \u001B[33mhelp\u001B[0m      Show available commands\r\n"
            + "  \u001B[33mclear\u001B[0m     Clear the terminal\r\n"
            + "  \u001B[33mwhoami\u001B[0m    Show current user\r\n"
            + "  \u001B[33mroom\u001B[0m      Show current room\r\n"
            + "  \u001B[33musers\u001B[0m     Show room users\r\n"
            + "  \u001B[33mls\u001B[0m        List workspace files\r\n\r\n"
        );
        send(session, "$ ");
        return;

      case "clear":
        send(session, "\u001B[2J\u001B[H");
        send(session, "$ ");
        return;

      case "whoami":
        send(session, "\r\n" + session.getAttributes().get("username") + "\r\n");
        send(session, "$ ");
        return;

      case "room":
        send(session, "\r\n" + session.getAttributes().get("room") + "\r\n");
        send(session, "$ ");
        return;

      case "users":
        sendUsers(session, (String) session.getAttributes().get("room"));
        send(session, "$ ");
        return;
    }

    /*
     * Delegate to execution service.
     */
    executionService.execute(clientId, command);
  }

  private void sendUsers(
    WebSocketSession session,
    String room
  ) throws IOException {

    Map<String, String> users = roomManager.getRoomUsers(room);

    if (users == null || users.isEmpty()) {
      send(session, "\r\nNo users connected.\r\n");
      return;
    }

    StringBuilder output = new StringBuilder("\r\n\u001B[32mConnected users:\u001B[0m\r\n");
    for (String username : users.values()) {
      output.append("  • ").append(username).append("\r\n");
    }

    send(session, output.toString());
  }

  private String getQueryParameter(
    WebSocketSession session,
    String parameter
  ) {
    URI uri = session.getUri();
    if (uri == null || uri.getRawQuery() == null) {
      return null;
    }

    for (String part : uri.getRawQuery().split("&")) {
      String[] keyValue = part.split("=", 2);
      if (
        keyValue.length == 2 &&
        parameter.equals(URLDecoder.decode(keyValue[0], StandardCharsets.UTF_8))
      ) {
        return URLDecoder.decode(keyValue[1], StandardCharsets.UTF_8);
      }
    }
    return null;
  }

  private void send(WebSocketSession session, String output) throws IOException {
    if (session.isOpen()) {
      session.sendMessage(new TextMessage(output));
    }
  }

  @Override
  public void afterConnectionClosed(
    WebSocketSession session,
    CloseStatus status
  ) {
    String clientId = (String) session.getAttributes().get("clientId");
    if (clientId != null) {
      sessionManager.removeSession(clientId);
    }
    logger.info(
      "Terminal disconnected: session={} clientId={} status={}",
      session.getId(),
      clientId,
      status
    );
  }
}
