package com.syncstream.backend.websocket;

import org.jspecify.annotations.NonNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

@Component
public class TerminalWebSocketHandler
  extends TextWebSocketHandler {

  private static final Logger logger =
    LoggerFactory.getLogger(
      TerminalWebSocketHandler.class
    );

  @Override
  public void afterConnectionEstablished(
    WebSocketSession session
  ) {
    String room =
      (String) session
        .getAttributes()
        .get("room");

    String clientId =
      (String) session
        .getAttributes()
        .get("clientId");

    logger.info(
      "Terminal WebSocket connected: {} room: {} client: {}",
      session.getId(),
      room,
      clientId
    );

    try {
      session.sendMessage(
        new TextMessage(
          "Terminal WebSocket connected.\r\n"
        )
      );
    } catch (Exception e) {
      logger.error(
        "Failed to send terminal connection message",
        e
      );
    }
  }

  @Override
  protected void handleTextMessage(
    WebSocketSession session,
    TextMessage message
  ) {
    // Phase 2 only verifies the terminal WebSocket connection.
    logger.debug(
      "Terminal input received from session {}: {}",
      session.getId(),
      message.getPayload()
    );
  }

  @Override
  public void afterConnectionClosed(
    WebSocketSession session,
    @NonNull CloseStatus status
  ) {
    String room =
      (String) session
        .getAttributes()
        .get("room");

    logger.info(
      "Terminal WebSocket disconnected: {} room: {} status: {}",
      session.getId(),
      room,
      status
    );
  }
}
