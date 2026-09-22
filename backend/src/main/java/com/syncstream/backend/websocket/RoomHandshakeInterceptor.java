package com.syncstream.backend.websocket;

import com.syncstream.backend.services.SecurityTokenService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Set;
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
 *   <li>{@code role} is cryptographically verified via HMAC-SHA256 {@code token} for privileged roles (owner, admin).</li>
 *   <li>{@code username} is validated and sanitized (if provided).</li>
 *   <li>Any parameter that fails structural validation closes the handshake immediately.</li>
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

  /** Known valid roles for server-side enforcement. */
  private static final Set<String> VALID_ROLES = Set.of(
    "viewer", "editor", "admin", "owner"
  );

  private final SecurityTokenService securityTokenService;

  public RoomHandshakeInterceptor(SecurityTokenService securityTokenService) {
    this.securityTokenService = securityTokenService;
  }

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
    String role     = "editor";
    String token    = null;
    String username = null;

    // Parse and URL-decode each parameter
    for (String parameter : query.split("&")) {
      String[] parts = parameter.split("=", 2);
      if (parts.length != 2) {
        continue;
      }

      try {
        String key   = URLDecoder.decode(parts[0], StandardCharsets.UTF_8);
        String value = URLDecoder.decode(parts[1], StandardCharsets.UTF_8);

        switch (key) {
          case "room" -> room = value;
          case "clientId" -> clientId = value;
          case "role" -> {
            String lowerRole = value.toLowerCase().trim();
            if (VALID_ROLES.contains(lowerRole)) {
              role = lowerRole;
            }
          }
          case "token" -> token = value;
          case "username" -> username = sanitizeUsername(value);
          default -> {}
        }
      } catch (IllegalArgumentException e) {
        // Malformed URL encoding
        logger.warn("WebSocket handshake rejected: malformed URL encoding in query param '{}' from {}",
          parts[0], request.getRemoteAddress());
        return false;
      }
    }

    // Both room and clientId must be present
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

    // Cryptographic role verification: privileged roles (owner, admin) require valid HMAC token
    if (("owner".equals(role) || "admin".equals(role)) && securityTokenService != null) {
      boolean valid = securityTokenService.verifyRoleToken(room, role, token);
      if (!valid) {
        logger.warn("Unverified privileged role attempt ('{}') for room '{}' without valid HMAC token. Downgrading to editor.",
          role, sanitize(room));
        role = "editor";
      }
    }

    // All checks passed — store in session attributes
    attributes.put("room",     room);
    attributes.put("clientId", clientId);
    attributes.put("role",     role);
    if (username != null) {
      attributes.put("username", username);
    }

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

  private static String sanitizeUsername(String raw) {
    if (raw == null) return "User";
    String clean = raw.replaceAll("[^a-zA-Z0-9 _\\-]", "").trim();
    if (clean.isBlank()) return "User";
    return clean.length() <= 32 ? clean : clean.substring(0, 32);
  }

  /** Truncates a value for safe logging (prevents log injection via long strings). */
  private static String sanitize(String value) {
    if (value == null) return "<null>";
    // Strip newlines/CR that could be used for log injection
    String clean = value.replaceAll("[\\r\\n\\t]", "_");
    return clean.length() <= 80 ? clean : clean.substring(0, 80) + "...[truncated]";
  }
}
