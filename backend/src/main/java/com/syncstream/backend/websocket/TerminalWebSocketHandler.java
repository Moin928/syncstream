package com.syncstream.backend.websocket;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.syncstream.backend.services.CommandSecurityFilter;
import com.syncstream.backend.services.TerminalExecutionService;
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
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Handles the collaborative terminal WebSocket channel at {@code /ws/terminal}.
 *
 * <p>The handler validates every incoming message, enforces a per-client
 * rate-limit, authorizes roles (blocking viewers), and dispatches to built-in commands or the execution service.
 */
@Component
public class TerminalWebSocketHandler
  extends TextWebSocketHandler {

  private static final Logger logger =
    LoggerFactory.getLogger(TerminalWebSocketHandler.class);

  // --------------------------------------------------------------------------
  // Rate-limiting — max 3 execute() calls per 10 s per clientId
  // --------------------------------------------------------------------------

  private static final int RATE_LIMIT_MAX    = 3;
  private static final int RATE_LIMIT_WINDOW = 10_000; // ms

  /** Token bucket counters keyed by clientId. */
  private final Map<String, AtomicInteger> rateLimitCounters =
    new ConcurrentHashMap<>();

  /** Time of the last window reset keyed by clientId. */
  private final Map<String, Long> rateLimitWindowStart =
    new ConcurrentHashMap<>();

  // --------------------------------------------------------------------------
  // Known languages accepted in a JSON run payload
  // --------------------------------------------------------------------------

  private static final Set<String> KNOWN_LANGUAGES = Set.of(
    "javascript", "typescript", "python", "java",
    "cpp", "c", "go", "rust", "csharp",
    "ruby", "php", "kotlin", "swift",
    "html", "css", "json", "sql"
  );

  private static final Set<String> READ_ONLY_BUILTINS = Set.of(
    "help", "clear", "whoami", "room", "users", "env", "date"
  );

  // --------------------------------------------------------------------------
  // Dependencies
  // --------------------------------------------------------------------------

  private final WebSocketRoomManager roomManager;
  private final TerminalSessionManager sessionManager;
  private final TerminalExecutionService executionService;
  private final CommandSecurityFilter securityFilter;
  private final ObjectMapper objectMapper = new ObjectMapper();

  public TerminalWebSocketHandler(
    WebSocketRoomManager roomManager,
    TerminalSessionManager sessionManager,
    TerminalExecutionService executionService,
    CommandSecurityFilter securityFilter
  ) {
    this.roomManager      = roomManager;
    this.sessionManager   = sessionManager;
    this.executionService = executionService;
    this.securityFilter   = securityFilter;
  }

  // --------------------------------------------------------------------------
  // Connection lifecycle
  // --------------------------------------------------------------------------

  @Override
  public void afterConnectionEstablished(WebSocketSession session) throws Exception {
    String room     = (String) session.getAttributes().get("room");
    String username = (String) session.getAttributes().get("username");
    String clientId = (String) session.getAttributes().get("clientId");
    String role     = (String) session.getAttributes().getOrDefault("role", "editor");

    // Fallback if interceptor was bypassed
    if (room == null || room.isBlank()) {
      room = getQueryParameter(session, "room");
    }
    if (username == null || username.isBlank()) {
      username = getQueryParameter(session, "username");
    }
    if (clientId == null || clientId.isBlank()) {
      clientId = getQueryParameter(session, "clientId");
    }

    if (username == null || username.isBlank()) {
      username = "User";
    }

    if (room == null || room.isBlank() || clientId == null || clientId.isBlank()) {
      send(session, "\r\nInvalid terminal session parameters.\r\n");
      session.close(CloseStatus.BAD_DATA);
      return;
    }

    session.getAttributes().put("room",     room);
    session.getAttributes().put("username", username);
    session.getAttributes().put("clientId", clientId);
    session.getAttributes().put("role",     role);

    sessionManager.createSession(clientId, room, username, session);

    logger.info(
      "Terminal connected: session={} clientId={} user={} role={} room={}",
      session.getId(), clientId, username, role, room
    );

    send(
      session,
      "\u001B[32mSyncStream Collaborative Terminal\u001B[0m\r\n"
        + "Connected as \u001B[33m" + sanitizeForTerminal(username) + " (" + role + ")\u001B[0m"
        + " in room \u001B[34m" + room + "\u001B[0m\r\n"
        + "Type \u001B[36m'help'\u001B[0m for available commands,"
        + ("viewer".equals(role) ? " (Read-only mode)" : " or click \u001B[32m'▶ Run'\u001B[0m above to execute.")
        + "\r\n\r\n$ "
    );
  }

  @Override
  public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
    String room     = (String) session.getAttributes().get("room");
    String clientId = (String) session.getAttributes().get("clientId");

    if (clientId != null) {
      sessionManager.removeSession(clientId);
      rateLimitCounters.remove(clientId);
      rateLimitWindowStart.remove(clientId);

      // Clean up sandbox temp files for this session
      executionService.cleanupSession(room, clientId);
    }

    logger.info(
      "Terminal disconnected: session={} clientId={} status={}",
      session.getId(), clientId, status
    );
  }

  // --------------------------------------------------------------------------
  // Message handling
  // --------------------------------------------------------------------------

  @Override
  protected void handleTextMessage(
    WebSocketSession session,
    TextMessage message
  ) throws Exception {

    // Reject payloads larger than 64 KB to prevent memory exhaustion
    if (message.getPayloadLength() > 64 * 1024) {
      send(session, "\r\n\u001B[31m[Error] Message too large (max 64 KB).\u001B[0m\r\n$ ");
      return;
    }

    String rawPayload = message.getPayload().trim();
    String clientId   = (String) session.getAttributes().get("clientId");
    String username   = (String) session.getAttributes().get("username");
    String role       = (String) session.getAttributes().getOrDefault("role", "editor");

    if (clientId == null || !sessionManager.hasSession(clientId)) {
      send(session, "\r\nTerminal session unavailable.\r\n");
      return;
    }

    if (rawPayload.isEmpty()) {
      send(session, "$ ");
      return;
    }

    // Ctrl+C — interrupt running process
    if (rawPayload.equals("\u0003")) {
      if (!"viewer".equals(role)) {
        executionService.interrupt(clientId);
      }
      return;
    }

    // Role enforcement: viewers cannot run code payloads
    if ("viewer".equals(role)) {
      if (rawPayload.startsWith("{") && rawPayload.endsWith("}")) {
        send(session, "\r\n\u001B[31m[Permission Denied] Viewers cannot execute code.\u001B[0m\r\n$ ");
        return;
      }

      String cmdLower = rawPayload.toLowerCase().trim();
      if (!READ_ONLY_BUILTINS.contains(cmdLower)) {
        send(session, "\r\n\u001B[31m[Permission Denied] Viewers cannot execute shell commands.\u001B[0m\r\n$ ");
        return;
      }
    }

    // JSON run-code payload from the Run button
    if (rawPayload.startsWith("{") && rawPayload.endsWith("}")) {
      if (handleJsonRunPayload(session, clientId, rawPayload)) {
        return;
      }
    }

    // Interactive stdin forwarding — if a process is already running, pipe input to its stdin
    if (executionService.isRunning(clientId)) {
      boolean sent = executionService.sendInput(clientId, rawPayload);
      if (sent) {
        return;
      }
    }

    // Built-in terminal commands
    String command = rawPayload;
    // Sanitize username for logging to prevent log injection
    logger.info("Terminal command from {} ({}): {}", sanitizeForLog(username), clientId,
      command.length() <= 200 ? command : command.substring(0, 200) + "...[truncated]");

    if (handleBuiltinCommand(session, command, clientId)) {
      return;
    }

    // Rate-limit check before delegating to the OS
    if (!checkRateLimit(clientId)) {
      send(session,
        "\r\n\u001B[33m[Rate limit] Too many commands. Please wait a moment.\u001B[0m\r\n$ "
      );
      return;
    }

    executionService.execute(clientId, command);
  }

  // --------------------------------------------------------------------------
  // JSON run payload handling
  // --------------------------------------------------------------------------

  private boolean handleJsonRunPayload(
    WebSocketSession session,
    String clientId,
    String rawPayload
  ) throws Exception {

    try {
      JsonNode node = objectMapper.readTree(rawPayload);
      if (!node.has("type")) {
        return false;
      }

      String type = node.get("type").asText();

      if ("run_project".equals(type)) {
        String language = node.has("language")
          ? node.get("language").asText("javascript")
          : "javascript";

        String activeFile = node.has("activeFile")
          ? node.get("activeFile").asText("main.js")
          : "main.js";

        Map<String, String> files = new java.util.HashMap<>();
        if (node.has("files") && node.get("files").isObject()) {
          node.get("files").fields().forEachRemaining(entry -> {
            files.put(entry.getKey(), entry.getValue().asText());
          });
        }

        if (!checkRateLimit(clientId)) {
          send(session,
            "\r\n\u001B[33m[Rate limit] Too many run requests. Please wait a moment.\u001B[0m\r\n$ "
          );
          return true;
        }

        executionService.executeProject(clientId, activeFile, language.toLowerCase(), files);
        return true;
      }

      if ("run".equals(type)) {
        String language = node.has("language")
          ? node.get("language").asText("javascript")
          : "javascript";

        String code = node.has("code")
          ? node.get("code").asText("")
          : "";

        // Validate language
        if (!KNOWN_LANGUAGES.contains(language.toLowerCase())) {
          send(session,
            "\r\n\u001B[31m[Error] Unknown language: " + language + "\u001B[0m\r\n$ "
          );
          return true;
        }

        // Rate-limit check
        if (!checkRateLimit(clientId)) {
          send(session,
            "\r\n\u001B[33m[Rate limit] Too many run requests. Please wait a moment.\u001B[0m\r\n$ "
          );
          return true;
        }

        executionService.executeCode(clientId, language.toLowerCase(), code);
        return true;
      }

      return false;

    } catch (Exception ignored) {
      // Not a valid JSON payload — fall through to shell execution
      return false;
    }
  }

  // --------------------------------------------------------------------------
  // Built-in commands (no process spawned)
  // --------------------------------------------------------------------------

  private boolean handleBuiltinCommand(
    WebSocketSession session,
    String command,
    String clientId
  ) throws IOException {

    return switch (command.toLowerCase().trim()) {
      case "help" -> {
        send(session,
          "\r\n\u001B[36mAvailable commands:\u001B[0m\r\n"
            + "  \u001B[33mhelp\u001B[0m        Show this help message\r\n"
            + "  \u001B[33mclear\u001B[0m       Clear the terminal\r\n"
            + "  \u001B[33mwhoami\u001B[0m      Show current username\r\n"
            + "  \u001B[33mroom\u001B[0m        Show current room ID\r\n"
            + "  \u001B[33musers\u001B[0m       List collaborators in this room\r\n"
            + "  \u001B[33mkill\u001B[0m        Terminate the running process\r\n"
            + "  \u001B[33menv\u001B[0m         Show safe environment information\r\n"
            + "  \u001B[33mdate\u001B[0m        Show current server date/time\r\n"
            + "  \u001B[33mversion\u001B[0m     Show available runtime versions\r\n"
            + "\r\nShortcuts:\r\n"
            + "  \u001B[33mCtrl+C\u001B[0m      Interrupt running process\r\n"
            + "  \u001B[33mCtrl+`\u001B[0m      Toggle terminal panel\r\n"
            + "  \u001B[33mCtrl+Enter / F5\u001B[0m  Run code\r\n\r\n"
        );
        send(session, "$ ");
        yield true;
      }

      case "clear" -> {
        send(session, "\u001B[2J\u001B[H$ ");
        yield true;
      }

      case "whoami" -> {
        String username = (String) session.getAttributes().get("username");
        String role     = (String) session.getAttributes().getOrDefault("role", "editor");
        send(session, "\r\n" + (username != null ? username : "unknown") + " (" + role + ")\r\n$ ");
        yield true;
      }

      case "room" -> {
        String room = (String) session.getAttributes().get("room");
        send(session, "\r\n" + (room != null ? room : "unknown") + "\r\n$ ");
        yield true;
      }

      case "users" -> {
        String room = (String) session.getAttributes().get("room");
        sendUsers(session, room);
        send(session, "$ ");
        yield true;
      }

      case "kill" -> {
        String role = (String) session.getAttributes().getOrDefault("role", "editor");
        if ("viewer".equals(role)) {
          send(session, "\r\n\u001B[31m[Permission Denied] Viewers cannot kill processes.\u001B[0m\r\n$ ");
        } else {
          executionService.interrupt(clientId);
          send(session, "\r\n\u001B[33mProcess interrupted.\u001B[0m\r\n$ ");
        }
        yield true;
      }

      case "env" -> {
        String username = (String) session.getAttributes().get("username");
        String room     = (String) session.getAttributes().get("room");
        String role     = (String) session.getAttributes().getOrDefault("role", "editor");
        send(session,
          "\r\n\u001B[36mEnvironment:\u001B[0m\r\n"
            + "  USER=" + (username != null ? username : "unknown") + "\r\n"
            + "  ROLE=" + role + "\r\n"
            + "  ROOM=" + (room != null ? room : "unknown") + "\r\n"
            + "  PLATFORM=SyncStream Collaborative IDE\r\n"
            + "  TIMEOUT=30s execution limit\r\n\r\n"
        );
        send(session, "$ ");
        yield true;
      }

      case "date" -> {
        String now = java.time.ZonedDateTime.now(java.time.ZoneOffset.UTC)
          .format(java.time.format.DateTimeFormatter.RFC_1123_DATE_TIME);
        send(session, "\r\n" + now + "\r\n$ ");
        yield true;
      }

      case "version" -> {
        String role = (String) session.getAttributes().getOrDefault("role", "editor");
        if ("viewer".equals(role)) {
          send(session, "\r\nNode.js 22, Python 3.12, Java 21, GCC 13, Go 1.22, Rust 1.75\r\n$ ");
        } else {
          executionService.execute(clientId,
            "echo -n 'Node: ' && node --version 2>/dev/null || echo 'Node: not found';"
              + "echo -n 'Python: ' && python3 --version 2>/dev/null || echo 'Python: not found';"
              + "echo -n 'Java: ' && java -version 2>&1 | head -1 || echo 'Java: not found';"
              + "echo -n 'g++: ' && g++ --version 2>/dev/null | head -1 || echo 'g++: not found';"
              + "echo -n 'Go: ' && go version 2>/dev/null || echo 'Go: not found';"
              + "echo -n 'Rust: ' && rustc --version 2>/dev/null || echo 'Rust: not found';"
          );
        }
        yield true;
      }

      default -> false;
    };
  }

  // --------------------------------------------------------------------------
  // Rate limiting
  // --------------------------------------------------------------------------

  private boolean checkRateLimit(String clientId) {
    long now = System.currentTimeMillis();

    Long windowStart = rateLimitWindowStart.get(clientId);
    if (windowStart == null || (now - windowStart) > RATE_LIMIT_WINDOW) {
      rateLimitWindowStart.put(clientId, now);
      rateLimitCounters.put(clientId, new AtomicInteger(1));
      return true;
    }

    AtomicInteger counter = rateLimitCounters.computeIfAbsent(
      clientId, k -> new AtomicInteger(0)
    );

    return counter.incrementAndGet() <= RATE_LIMIT_MAX;
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private void sendUsers(WebSocketSession session, String room) throws IOException {
    Map<String, String> users = roomManager.getRoomUsers(room);

    if (users == null || users.isEmpty()) {
      send(session, "\r\nNo users connected.\r\n");
      return;
    }

    StringBuilder sb = new StringBuilder("\r\n\u001B[32mConnected users:\u001B[0m\r\n");
    for (String name : users.values()) {
      sb.append("  • ").append(sanitizeForTerminal(name)).append("\r\n");
    }

    send(session, sb.toString());
  }

  private String getQueryParameter(WebSocketSession session, String parameter) {
    URI uri = session.getUri();
    if (uri == null || uri.getRawQuery() == null) {
      return null;
    }

    for (String part : uri.getRawQuery().split("&")) {
      String[] kv = part.split("=", 2);
      if (kv.length == 2 &&
        parameter.equals(URLDecoder.decode(kv[0], StandardCharsets.UTF_8))) {
        return URLDecoder.decode(kv[1], StandardCharsets.UTF_8);
      }
    }
    return null;
  }

  private void send(WebSocketSession session, String output) throws IOException {
    if (session.isOpen()) {
      session.sendMessage(new TextMessage(output));
    }
  }

  private static String sanitizeForLog(String value) {
    if (value == null) return "<null>";
    String clean = value.replaceAll("\u001B\\[[;\\d]*[mGKHF]", "");
    clean = clean.replaceAll("[\\r\\n\\t\u0000-\u001F\u007F]", "_");
    return clean.length() <= 80 ? clean : clean.substring(0, 80) + "...[truncated]";
  }

  private static String sanitizeForTerminal(String value) {
    if (value == null) return "<unknown>";
    String clean = value.replaceAll("\u001B\\[[;\\d]*[mGKHF]", "");
    clean = clean.replaceAll("[\\x00-\\x1F\\x7F]", "");
    return clean.length() <= 50 ? clean : clean.substring(0, 50) + "...";
  }
}
