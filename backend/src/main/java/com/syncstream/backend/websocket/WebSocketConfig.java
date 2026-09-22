package com.syncstream.backend.websocket;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean;

/**
 * WebSocket configuration.
 *
 * <p><strong>Security:</strong> Origins are restricted to the known frontend URLs.
 * The wildcard {@code *} is intentionally NOT used because it would allow any
 * website to open a WebSocket to this server and relay arbitrary commands.
 *
 * <p>Override the defaults via the {@code SYNCSTREAM_ALLOWED_ORIGINS} environment
 * variable (comma-separated patterns) when deploying to production.
 */
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

  private final CodeWebSocketHandler codeWebSocketHandler;
  private final TerminalWebSocketHandler terminalWebSocketHandler;

  /**
   * Allowed origin patterns, configurable via environment/application.properties.
   * Defaults to localhost dev server only.
   */
  @Value("${syncstream.websocket.allowed-origins:http://localhost:5173,http://localhost:4173,http://localhost:3000}")
  private String allowedOriginsConfig;

  public WebSocketConfig(
    CodeWebSocketHandler codeWebSocketHandler,
    TerminalWebSocketHandler terminalWebSocketHandler
  ) {
    this.codeWebSocketHandler = codeWebSocketHandler;
    this.terminalWebSocketHandler = terminalWebSocketHandler;
  }

  @Override
  public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
    String[] origins = allowedOriginsConfig.split(",");

    registry
      .addHandler(codeWebSocketHandler, "/ws")
      .addInterceptors(new RoomHandshakeInterceptor())
      .setAllowedOrigins(origins);

    registry
      .addHandler(terminalWebSocketHandler, "/ws/terminal")
      .setAllowedOrigins(origins);
  }

  @Bean
  public ServletServerContainerFactoryBean webSocketContainer() {
    ServletServerContainerFactoryBean container =
      new ServletServerContainerFactoryBean();

    // 2 MB cap — rejects abnormally large binary frames (was 10 MB, overkill)
    container.setMaxBinaryMessageBufferSize(2 * 1024 * 1024);

    // 128 KB cap for text messages (terminal commands, presence JSON)
    container.setMaxTextMessageBufferSize(128 * 1024);

    // 5 s async-send timeout prevents a slow client from blocking the sender thread
    container.setAsyncSendTimeout(5_000L);

    return container;
  }
}
