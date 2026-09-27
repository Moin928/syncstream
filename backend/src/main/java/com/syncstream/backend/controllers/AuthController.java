package com.syncstream.backend.controllers;

import com.syncstream.backend.dto.AuthDto.*;
import com.syncstream.backend.models.User;
import com.syncstream.backend.repositories.UserRepository;
import com.syncstream.backend.services.JwtTokenService;
import com.syncstream.backend.services.PasswordService;
import com.syncstream.backend.services.RateLimitingService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

  private static final Pattern USERNAME_PATTERN = Pattern.compile("^[a-zA-Z0-9_\\-]{3,32}$");
  private static final Pattern EMAIL_PATTERN = Pattern.compile("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");

  private final UserRepository userRepository;
  private final PasswordService passwordService;
  private final JwtTokenService jwtTokenService;
  private final RateLimitingService rateLimitingService;

  public AuthController(
    UserRepository userRepository,
    PasswordService passwordService,
    JwtTokenService jwtTokenService,
    RateLimitingService rateLimitingService
  ) {
    this.userRepository = userRepository;
    this.passwordService = passwordService;
    this.jwtTokenService = jwtTokenService;
    this.rateLimitingService = rateLimitingService;
  }

  /**
   * Register a new user account.
   */
  @PostMapping("/register")
  public ResponseEntity<?> register(
    @RequestBody RegisterRequest request,
    HttpServletRequest httpRequest
  ) {
    String clientIp = getClientIp(httpRequest);

    // Rate limiting: max 10 registrations per minute per IP
    if (!rateLimitingService.allowRequest(clientIp, "auth_register", 10, 60_000)) {
      return ResponseEntity
        .status(HttpStatus.TOO_MANY_REQUESTS)
        .body(new AuthResponse(null, null, "Too many registration attempts. Please try again later."));
    }

    if (request == null) {
      return ResponseEntity.badRequest().body(new AuthResponse(null, null, "Invalid request body."));
    }

    String username = request.username() != null ? request.username().trim() : "";
    String email = request.email() != null ? request.email().trim().toLowerCase() : "";
    String password = request.password() != null ? request.password() : "";
    String displayName = request.displayName() != null ? request.displayName().trim() : username;

    // Validate username
    if (!USERNAME_PATTERN.matcher(username).matches()) {
      return ResponseEntity.badRequest().body(new AuthResponse(null, null, "Username must be 3-32 alphanumeric characters, underscores or hyphens."));
    }

    // Validate email
    if (!EMAIL_PATTERN.matcher(email).matches()) {
      return ResponseEntity.badRequest().body(new AuthResponse(null, null, "Please provide a valid email address."));
    }

    // Validate password
    if (password.length() < 6 || password.length() > 128) {
      return ResponseEntity.badRequest().body(new AuthResponse(null, null, "Password must be between 6 and 128 characters."));
    }

    // Check duplicate username
    if (userRepository.existsByUsername(username.toLowerCase())) {
      return ResponseEntity.status(HttpStatus.CONFLICT).body(new AuthResponse(null, null, "Username is already taken."));
    }

    // Check duplicate email
    if (userRepository.existsByEmail(email)) {
      return ResponseEntity.status(HttpStatus.CONFLICT).body(new AuthResponse(null, null, "Email is already registered."));
    }

    // Create user
    String salt = passwordService.generateSalt();
    String passwordHash = passwordService.hashPassword(password, salt);
    User user = new User(username, email, passwordHash, salt, displayName);
    userRepository.save(user);

    // Generate JWT
    String token = jwtTokenService.generateToken(user.getId(), user.getUsername(), user.getEmail(), user.getDisplayName());
    UserDto userDto = UserDto.fromEntity(user);

    return ResponseEntity.status(HttpStatus.CREATED).body(new AuthResponse(token, userDto, "Registration successful!"));
  }

  /**
   * Log in with username or email and password.
   */
  @PostMapping("/login")
  public ResponseEntity<?> login(
    @RequestBody LoginRequest request,
    HttpServletRequest httpRequest
  ) {
    String clientIp = getClientIp(httpRequest);

    // Rate limiting: max 20 login attempts per minute per IP
    if (!rateLimitingService.allowRequest(clientIp, "auth_login", 20, 60_000)) {
      return ResponseEntity
        .status(HttpStatus.TOO_MANY_REQUESTS)
        .body(new AuthResponse(null, null, "Too many login attempts. Please wait a moment before trying again."));
    }

    if (request == null || request.usernameOrEmail() == null || request.password() == null) {
      return ResponseEntity.badRequest().body(new AuthResponse(null, null, "Username/email and password are required."));
    }

    String identifier = request.usernameOrEmail().trim();
    String password = request.password();

    if (identifier.isBlank() || password.isBlank()) {
      return ResponseEntity.badRequest().body(new AuthResponse(null, null, "Username/email and password are required."));
    }

    Optional<User> optionalUser = userRepository.findByUsernameOrEmail(identifier);
    if (optionalUser.isEmpty()) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new AuthResponse(null, null, "Invalid username/email or password."));
    }

    User user = optionalUser.get();
    boolean passwordMatch = passwordService.verifyPassword(password, user.getPasswordHash(), user.getSalt());

    if (!passwordMatch) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new AuthResponse(null, null, "Invalid username/email or password."));
    }

    // Generate JWT
    String token = jwtTokenService.generateToken(user.getId(), user.getUsername(), user.getEmail(), user.getDisplayName());
    UserDto userDto = UserDto.fromEntity(user);

    return ResponseEntity.ok(new AuthResponse(token, userDto, "Login successful!"));
  }

  /**
   * Get the current user profile from the Authorization Bearer token.
   */
  @GetMapping("/me")
  public ResponseEntity<?> getCurrentUser(
    @RequestHeader(value = "Authorization", required = false) String authHeader,
    HttpServletRequest httpRequest
  ) {
    String clientIp = getClientIp(httpRequest);
    if (!rateLimitingService.allowRequest(clientIp, "auth_me", 120, 60_000)) {
      return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).build();
    }

    if (authHeader == null || !authHeader.startsWith("Bearer ")) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new AuthResponse(null, null, "Missing or invalid authorization header."));
    }

    String token = authHeader.substring(7).trim();
    var claimsOpt = jwtTokenService.validateAndParseToken(token);

    if (claimsOpt.isEmpty()) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new AuthResponse(null, null, "Invalid or expired token."));
    }

    var claims = claimsOpt.get();
    Optional<User> optionalUser = userRepository.findById(claims.userId());

    if (optionalUser.isEmpty()) {
      return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new AuthResponse(null, null, "User no longer exists."));
    }

    User user = optionalUser.get();
    return ResponseEntity.ok(new AuthResponse(token, UserDto.fromEntity(user), "User found"));
  }

  /**
   * Update profile information for the authenticated user.
   */
  @PutMapping("/profile")
  public ResponseEntity<?> updateProfile(
    @RequestHeader(value = "Authorization", required = false) String authHeader,
    @RequestBody UpdateProfileRequest request
  ) {
    if (authHeader == null || !authHeader.startsWith("Bearer ")) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new AuthResponse(null, null, "Unauthorized."));
    }

    String token = authHeader.substring(7).trim();
    var claimsOpt = jwtTokenService.validateAndParseToken(token);

    if (claimsOpt.isEmpty()) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new AuthResponse(null, null, "Invalid or expired token."));
    }

    var claims = claimsOpt.get();
    Optional<User> optionalUser = userRepository.findById(claims.userId());
    if (optionalUser.isEmpty()) {
      return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new AuthResponse(null, null, "User not found."));
    }

    User user = optionalUser.get();
    if (request != null) {
      user.updateProfile(request.displayName(), request.avatar());
      userRepository.save(user);
    }

    return ResponseEntity.ok(new AuthResponse(token, UserDto.fromEntity(user), "Profile updated successfully."));
  }

  private String getClientIp(HttpServletRequest request) {
    String xForwardedFor = request.getHeader("X-Forwarded-For");
    if (xForwardedFor != null && !xForwardedFor.isBlank()) {
      return xForwardedFor.split(",")[0].trim();
    }
    return request.getRemoteAddr();
  }
}
