package com.syncstream.backend.websocket;

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
    LoggerFactory.getLogger(
      TerminalWebSocketHandler.class
    );

  private final WebSocketRoomManager roomManager;

  public TerminalWebSocketHandler(
    WebSocketRoomManager roomManager
  ) {
    this.roomManager = roomManager;
  }

  @Override
  public void afterConnectionEstablished(
    WebSocketSession session
  ) throws Exception {

    String room =
      getQueryParameter(
        session,
        "room"
      );

    String username =
      getQueryParameter(
        session,
        "username"
      );

    String clientId =
      getQueryParameter(
        session,
        "clientId"
      );

    if (
      room == null ||
        room.isBlank() ||
        username == null ||
        username.isBlank() ||
        clientId == null ||
        clientId.isBlank()
    ) {
      send(
        session,
        "\r\nInvalid terminal session.\r\n"
      );

      session.close(
        CloseStatus.BAD_DATA
      );

      return;
    }

    session.getAttributes().put(
      "room",
      room
    );

    session.getAttributes().put(
      "username",
      username
    );

    session.getAttributes().put(
      "clientId",
      clientId
    );

    logger.info(
      "Terminal connected: {} user: {} room: {}",
      session.getId(),
      username,
      room
    );

    send(
      session,
      "SyncStream Terminal\r\n"
        + "Connected as "
        + username
        + "\r\n"
        + "Room: "
        + room
        + "\r\n"
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
      send(
        session,
        "$ "
      );
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

    String room =
      (String) session
        .getAttributes()
        .get("room");

    String username =
      (String) session
        .getAttributes()
        .get("username");

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
          "\r\n"
            + username
            + "\r\n"
        );

        break;

      case "room":

        send(
          session,
          "\r\n"
            + room
            + "\r\n"
        );

        break;

      case "users":

        sendUsers(
          session,
          room
        );

        break;

      default:

        if (
          command.startsWith("echo ")
        ) {

          String text =
            command.substring(5);

          send(
            session,
            "\r\n"
              + text
              + "\r\n"
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

  private void sendUsers(
    WebSocketSession session,
    String room
  ) throws IOException {

    Map<String, String> users =
      roomManager.getRoomUsers(room);

    if (
      users == null ||
        users.isEmpty()
    ) {

      send(
        session,
        "\r\nNo users connected.\r\n"
      );

      return;
    }

    StringBuilder output =
      new StringBuilder(
        "\r\nConnected users:\r\n"
      );

    for (
      String username :
      users.values()
    ) {

      output
        .append("  ")
        .append(username)
        .append("\r\n");
    }

    send(
      session,
      output.toString()
    );
  }

  private String getQueryParameter(
    WebSocketSession session,
    String parameter
  ) {

    URI uri =
      session.getUri();

    if (
      uri == null ||
        uri.getRawQuery() == null
    ) {
      return null;
    }

    for (
      String part :
      uri.getRawQuery().split("&")
    ) {

      String[] keyValue =
        part.split("=", 2);

      if (
        keyValue.length == 2 &&
          parameter.equals(
            URLDecoder.decode(
              keyValue[0],
              StandardCharsets.UTF_8
            )
          )
      ) {

        return URLDecoder.decode(
          keyValue[1],
          StandardCharsets.UTF_8
        );
      }
    }

    return null;
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
      "Terminal disconnected: {} status={}",
      session.getId(),
      status
    );
  }
}
