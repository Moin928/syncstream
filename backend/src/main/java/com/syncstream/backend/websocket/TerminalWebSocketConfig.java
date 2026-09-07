package com.syncstream.backend.websocket;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class TerminalWebSocketConfig implements WebSocketConfigurer {

  private final TerminalWebSocketHandler terminalWebSocketHandler;

  public TerminalWebSocketConfig(
    TerminalWebSocketHandler terminalWebSocketHandler
  ) {
    this.terminalWebSocketHandler = terminalWebSocketHandler;
  }

  @Override
  public void registerWebSocketHandlers(
    WebSocketHandlerRegistry registry
  ) {
    registry
      .addHandler(
        terminalWebSocketHandler,
        "/ws/terminal"
      )
      .setAllowedOrigins(
        "http://localhost:5173"
      );
  }
}
