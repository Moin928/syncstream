package com.syncstream.backend.websocket;

import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

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
  ) throws Exception {

    logger.info(
      "Terminal connected: {}",
      session.getId()
    );

    send(
      session,
      "SyncStream Terminal\r\n"
        + "Phase 2 terminal ready.\r\n"
        + "Type 'help' for available commands.\r\n"
        + "\r\n$ "
    );
  }

  @Override
  protected void handleTextMessage(
    WebSocketSession session,
    TextMessage message
  ) throws Exception {

    String command =
      message.getPayload().trim();

    if (command.isEmpty()) {
      send(session, "\r\n$ ");
      return;
    }

    logger.info(
      "Terminal command from {}: {}",
      session.getId(),
      command
    );

    handleCommand(
      session,
      command
    );
  }

  private void handleCommand(
    WebSocketSession session,
    String command
  ) throws IOException {

    switch (command) {

      case "help":
        send(
          session,
          "\r\nAvailable commands:\r\n"
            + "  help     Show available commands\r\n"
            + "  clear    Clear the terminal\r\n"
            + "  echo     Echo text\r\n"
            + "  whoami   Show current user\r\n"
            + "  room     Show current room\r\n"
            + "  users    Show room users\r\n"
        );
        break;

      case "clear":
        send(
          session,
          "\u001B[2J\u001B[H"
        );
        break;

      case "whoami":
        send(
          session,
          "\r\nsyncstream-user\r\n"
        );
        break;

      case "room":
        send(
          session,
          "\r\nRoom information will be connected here next.\r\n"
        );
        break;

      case "users":
        send(
          session,
          "\r\nRoom users will be connected here next.\r\n"
        );
        break;

      default:

        if (command.startsWith("echo ")) {

          String text =
            command.substring(5);

          send(
            session,
            "\r\n" + text + "\r\n"
          );

        } else {

          send(
            session,
            "\r\nCommand not found: "
              + command
              + "\r\n"
          );
        }

        break;
    }

    send(
      session,
      "$ "
    );
  }

  private void send(
    WebSocketSession session,
    String output
  ) throws IOException {

    if (session.isOpen()) {
      session.sendMessage(
        new TextMessage(output)
      );
    }
  }

  @Override
  public void afterConnectionClosed(
    WebSocketSession session,
    CloseStatus status
  ) {

    logger.info(
      "Terminal disconnected: {}",
      session.getId()
    );
  }
}
