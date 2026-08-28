package com.syncstream.backend.websocket;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

  private final CodeWebSocketHandler codeWebSocketHandler;
  private final TerminalWebSocketHandler terminalWebSocketHandler;

  public WebSocketConfig(
    CodeWebSocketHandler codeWebSocketHandler,
    TerminalWebSocketHandler terminalWebSocketHandler
  ) {
    this.codeWebSocketHandler =
      codeWebSocketHandler;

    this.terminalWebSocketHandler =
      terminalWebSocketHandler;
  }

  @Override
  public void registerWebSocketHandlers(
    WebSocketHandlerRegistry registry
  ) {
    // WebSocket used for collaborative code editing.
    registry
      .addHandler(
        codeWebSocketHandler,
        "/ws"
      )
      .addInterceptors(
        new RoomHandshakeInterceptor()
      )
      .setAllowedOrigins("*");

    // Separate WebSocket used by the terminal.
    registry
      .addHandler(
        terminalWebSocketHandler,
        "/terminal/ws"
      )
      .addInterceptors(
        new RoomHandshakeInterceptor()
      )
      .setAllowedOrigins("*");
  }

  @Bean
  public ServletServerContainerFactoryBean webSocketContainer() {

    ServletServerContainerFactoryBean container =
      new ServletServerContainerFactoryBean();

    // increases the binary message buffer size to 5 MB
    container.setMaxBinaryMessageBufferSize(
      5 * 1024 * 1024
    );

    // increases the text message buffer size to 5 MB
    container.setMaxTextMessageBufferSize(
      5 * 1024 * 1024
    );

    return container;
  }
}
