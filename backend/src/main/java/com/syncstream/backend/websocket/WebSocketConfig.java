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
    this.codeWebSocketHandler = codeWebSocketHandler;
    this.terminalWebSocketHandler = terminalWebSocketHandler;
  }

  @Override
  public void registerWebSocketHandlers(
      WebSocketHandlerRegistry registry
  ) {
      registry
          .addHandler(
              codeWebSocketHandler,
              "/ws"
          )
          .addInterceptors(
              new RoomHandshakeInterceptor()
          )
          .setAllowedOrigins("*");

      registry
          .addHandler(
              terminalWebSocketHandler,
              "/ws/terminal"
          )
          .setAllowedOrigins(
              "http://localhost:5173"
          );
  }

  @Bean
  public ServletServerContainerFactoryBean webSocketContainer() {

    ServletServerContainerFactoryBean container =
      new ServletServerContainerFactoryBean();

    container.setMaxBinaryMessageBufferSize(
      5 * 1024 * 1024
    );

    container.setMaxTextMessageBufferSize(
      5 * 1024 * 1024
    );

    return container;
  }
}
