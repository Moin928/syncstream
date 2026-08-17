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

  public WebSocketConfig(
    CodeWebSocketHandler codeWebSocketHandler
  ) {
    this.codeWebSocketHandler = codeWebSocketHandler;
  }

  @Override
  public void registerWebSocketHandlers(
    WebSocketHandlerRegistry registry
  ) {
    // registers the websocket endpoint and the interceptor used for room details
    registry
      .addHandler(
        codeWebSocketHandler,
        "/ws"
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

    // increases the binary message buffer size to 5 mb
    container.setMaxBinaryMessageBufferSize(
      5 * 1024 * 1024
    );

    // increases the text message buffer size to 5 mb
    container.setMaxTextMessageBufferSize(
      5 * 1024 * 1024
    );

    return container;
  }
}
