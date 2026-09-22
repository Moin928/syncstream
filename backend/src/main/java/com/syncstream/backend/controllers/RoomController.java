package com.syncstream.backend.controllers;

import com.syncstream.backend.models.Room;
import com.syncstream.backend.repositories.RoomRepository;
import com.syncstream.backend.services.RateLimitingService;
import com.syncstream.backend.services.SecurityTokenService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/rooms")
public class RoomController {

  private static final Pattern ROOM_ID_PATTERN = Pattern.compile("^[a-zA-Z0-9\\-]{1,64}$");

  private final RoomRepository roomRepository;
  private final RateLimitingService rateLimitingService;
  private final SecurityTokenService securityTokenService;

  public RoomController(
    RoomRepository roomRepository,
    RateLimitingService rateLimitingService,
    SecurityTokenService securityTokenService
  ) {
    this.roomRepository = roomRepository;
    this.rateLimitingService = rateLimitingService;
    this.securityTokenService = securityTokenService;
  }

  @PostMapping
  public ResponseEntity<String> createRoom(HttpServletRequest request) {
    String clientIp = getClientIp(request);

    // Rate limit: max 15 room creations per minute per IP
    if (!rateLimitingService.allowRequest(clientIp, "create_room", 15, 60_000)) {
      return ResponseEntity
        .status(HttpStatus.TOO_MANY_REQUESTS)
        .body("Rate limit exceeded. Please wait a moment before creating another room.");
    }

    // Generates a cryptographically secure UUID for the new room
    String roomId = UUID.randomUUID().toString();
    Room room = new Room(roomId);
    roomRepository.save(room);

    return ResponseEntity
      .status(HttpStatus.CREATED)
      .body(roomId);
  }

  @GetMapping("/{roomId}")
  public ResponseEntity<Void> checkRoom(
    @PathVariable String roomId,
    HttpServletRequest request
  ) {
    String clientIp = getClientIp(request);

    // Rate limit: max 120 room checks per minute per IP
    if (!rateLimitingService.allowRequest(clientIp, "check_room", 120, 60_000)) {
      return ResponseEntity
        .status(HttpStatus.TOO_MANY_REQUESTS)
        .build();
    }

    // Validate roomId format before querying database
    if (roomId == null || !ROOM_ID_PATTERN.matcher(roomId).matches()) {
      return ResponseEntity
        .badRequest()
        .build();
    }

    // Checks whether the requested room exists in the database
    if (!roomRepository.existsById(roomId)) {
      return ResponseEntity
        .notFound()
        .build();
    }

    return ResponseEntity.ok().build();
  }

  /**
   * Generates a cryptographically signed HMAC role token for room invite links.
   */
  @GetMapping("/{roomId}/token")
  public ResponseEntity<Map<String, String>> getRoleToken(
    @PathVariable String roomId,
    @RequestParam(defaultValue = "editor") String role,
    HttpServletRequest request
  ) {
    String clientIp = getClientIp(request);

    // Rate limit: max 60 token generations per minute per IP
    if (!rateLimitingService.allowRequest(clientIp, "get_token", 60, 60_000)) {
      return ResponseEntity
        .status(HttpStatus.TOO_MANY_REQUESTS)
        .build();
    }

    if (roomId == null || !ROOM_ID_PATTERN.matcher(roomId).matches()) {
      return ResponseEntity
        .badRequest()
        .build();
    }

    if (!roomRepository.existsById(roomId)) {
      return ResponseEntity
        .notFound()
        .build();
    }

    String token = securityTokenService.generateRoleToken(roomId, role);
    return ResponseEntity.ok(Map.of(
      "roomId", roomId,
      "role", role.toLowerCase(),
      "token", token
    ));
  }

  private String getClientIp(HttpServletRequest request) {
    String xForwardedFor = request.getHeader("X-Forwarded-For");
    if (xForwardedFor != null && !xForwardedFor.isBlank()) {
      return xForwardedFor.split(",")[0].trim();
    }
    return request.getRemoteAddr();
  }
}
