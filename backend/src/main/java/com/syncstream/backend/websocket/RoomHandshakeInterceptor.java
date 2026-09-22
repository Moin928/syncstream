package com.syncstream.backend.websocket;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Validates and normalises WebSocket handshake parameters before a session is
 * allowed to open.
 *
 * <p><strong>Security checks performed:</strong>
 * <ul>
 *   <li>Both {@code room} and {@code clientId} query parameters must be present.</li>
 *   <li>Values are URL-decoded using UTF-8 before validation.</li>
 *   <li>{@code clientId} must be a valid UUID (RFC 4122 format).</li>
 *   <li>{@code room} must be alphanumeric with optional hyphens, 1–64 chars.</li>
 *   <li>Any parameter that fails validation closes the handshake immediately.</li>
 * </ul>
 */
public class RoomHandshakeInterceptor implements HandshakeInterceptor {

  private static final Logger logger =
    LoggerFactory.getLogger(RoomHandshakeInterceptor.class);

  /** UUID v4 pattern — 8-4-4-4-12 hex digits separated by hyphens. */
  private static final Pattern UUID_PATTERN =
    Pattern.compile("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
      Pattern.CASE_INSENSITIVE);

  /**
   * Room ID: alphanumeric + hyphens only, 1–64 characters.
   * Prevents log injection, shell metacharacter injection, and room-name collision attacks.
   */
  private static final Pattern ROOM_PATTERN =
    Pattern.compile("^[a-zA-Z0-9\\-]{1,64}$");

  @Override
  public boolean beforeHandshake(
    ServerHttpRequest request,
    ServerHttpResponse response,
    WebSocketHandler wsHandler,
    Map<String, Object> attributes
  ) {
    String query = request.getURI().getQuery();

    if (query == null || query.isBlank()) {
      logger.warn("WebSocket handshake rejected: missing query string from {}",
        request.getRemoteAddress());
      return false;
    }

    String room     = null;
    String clientId = null;

    // Parse and URL-decode each parameter
    for (String parameter : query.split("&")) {
      String[] parts = parameter.split("=", 2);
      if (parts.length != 2) {
        continue;
      }

      try {
        String key   = URLDecoder.decode(parts[0], StandardCharsets.UTF_8);
        String value = URLDecoder.decode(parts[1], StandardCharsets.UTF_8);

        if ("room".equals(key)) {
          room = value;
        } else if ("clientId".equals(key)) {
          clientId = value;
        }
      } catch (IllegalArgumentException e) {
        // Malformed URL encoding
        logger.warn("WebSocket handshake rejected: malformed URL encoding in query param '{}' from {}",
          parts[0], request.getRemoteAddress());
        return false;
      }
    }

    // Both params must be present
    if (room == null || room.isBlank()) {
      logger.warn("WebSocket handshake rejected: missing 'room' parameter from {}",
        request.getRemoteAddress());
      return false;
    }

    if (clientId == null || clientId.isBlank()) {
      logger.warn("WebSocket handshake rejected: missing 'clientId' parameter from {}",
        request.getRemoteAddress());
      return false;
    }

    // Validate room format
    if (!ROOM_PATTERN.matcher(room).matches()) {
      logger.warn("WebSocket handshake rejected: invalid room format '{}' from {}",
        sanitize(room), request.getRemoteAddress());
      return false;
    }

    // Validate clientId format (must be a UUID)
    if (!UUID_PATTERN.matcher(clientId).matches()) {
      logger.warn("WebSocket handshake rejected: invalid clientId format from {}",
        request.getRemoteAddress());
      return false;
    }

    // All checks passed — store in session attributes
    attributes.put("room",     room);
    attributes.put("clientId", clientId);

    return true;
  }

  @Override
  public void afterHandshake(
    ServerHttpRequest request,
    ServerHttpResponse response,
    WebSocketHandler wsHandler,
    Exception exception
  ) {
  }

  /** Truncates a value for safe logging (prevents log injection via long strings). */
  private static String sanitize(String value) {
    if (value == null) return "<null>";
    // Strip newlines/CR that could be used for log injection
    String clean = value.replaceAll("[\\r\\n\\t]", "_");
    return clean.length() <= 80 ? clean : clean.substring(0, 80) + "...[truncated]";
  }
}
