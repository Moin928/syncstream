package com.syncstream.backend.controllers;

import com.syncstream.backend.models.Room;
import com.syncstream.backend.repositories.RoomRepository;
import com.syncstream.backend.services.JwtTokenService;
import com.syncstream.backend.services.RateLimitingService;
import com.syncstream.backend.services.SecurityTokenService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/rooms")
public class RoomController {

  private static final Pattern ROOM_ID_PATTERN = Pattern.compile("^[a-zA-Z0-9\\-]{1,64}$");

  private final RoomRepository roomRepository;
  private final RateLimitingService rateLimitingService;
  private final SecurityTokenService securityTokenService;
  private final JwtTokenService jwtTokenService;

  public RoomController(
    RoomRepository roomRepository,
    RateLimitingService rateLimitingService,
    SecurityTokenService securityTokenService,
    JwtTokenService jwtTokenService
  ) {
    this.roomRepository = roomRepository;
    this.rateLimitingService = rateLimitingService;
    this.securityTokenService = securityTokenService;
    this.jwtTokenService = jwtTokenService;
  }

  @PostMapping
  public ResponseEntity<String> createRoom(
    @RequestHeader(value = "Authorization", required = false) String authHeader,
    HttpServletRequest request
  ) {
    String clientIp = getClientIp(request);

    // Rate limit: max 15 room creations per minute per IP
    if (!rateLimitingService.allowRequest(clientIp, "create_room", 15, 60_000)) {
      return ResponseEntity
        .status(HttpStatus.TOO_MANY_REQUESTS)
        .body("Rate limit exceeded. Please wait a moment before creating another room.");
    }

    String ownerId = null;
    boolean isGuest = true;

    // Check if user is authenticated with a valid JWT
    if (authHeader != null && authHeader.startsWith("Bearer ")) {
      String token = authHeader.substring(7).trim();
      var claimsOpt = jwtTokenService.validateAndParseToken(token);
      if (claimsOpt.isPresent()) {
        ownerId = claimsOpt.get().userId();
        isGuest = false;
      }
    }

    // Generates a cryptographically secure UUID for the new room
    String roomId = UUID.randomUUID().toString();
    Room room = new Room(roomId, ownerId, isGuest);
    roomRepository.save(room);

    return ResponseEntity
      .status(HttpStatus.CREATED)
      .body(roomId);
  }

  @GetMapping("/{roomId}")
  public ResponseEntity<?> checkRoom(
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

    Optional<Room> optionalRoom = roomRepository.findById(roomId);
    if (optionalRoom.isEmpty()) {
      return ResponseEntity
        .notFound()
        .build();
    }

    Room room = optionalRoom.get();
    return ResponseEntity.ok(Map.of(
      "roomId", room.getId(),
      "isGuest", room.isGuest(),
      "createdAt", room.getCreatedAt().toString()
    ));
  }

  /**
   * Returns all persistent rooms owned by the authenticated user.
   */
  @GetMapping("/my-rooms")
  public ResponseEntity<?> getMyRooms(
    @RequestHeader(value = "Authorization", required = false) String authHeader
  ) {
    if (authHeader == null || !authHeader.startsWith("Bearer ")) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Unauthorized");
    }

    String token = authHeader.substring(7).trim();
    var claimsOpt = jwtTokenService.validateAndParseToken(token);
    if (claimsOpt.isEmpty()) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid token");
    }

    String userId = claimsOpt.get().userId();
    List<Room> rooms = roomRepository.findByOwnerIdOrderByUpdatedAtDesc(userId);

    List<Map<String, Object>> response = rooms.stream().map(r -> Map.<String, Object>of(
      "roomId", r.getId(),
      "createdAt", r.getCreatedAt().toString(),
      "updatedAt", r.getUpdatedAt().toString()
    )).toList();

    return ResponseEntity.ok(response);
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
