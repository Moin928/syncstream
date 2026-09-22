package com.syncstream.backend.services;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Service for generating and verifying cryptographic HMAC-SHA256 tokens.
 *
 * <p>Prevents role forgery (e.g. self-asserting role=owner or role=admin in URL query parameters).
 */
@Service
public class SecurityTokenService {

  private static final Logger logger =
    LoggerFactory.getLogger(SecurityTokenService.class);

  private static final String HMAC_ALGORITHM = "HmacSHA256";

  private final byte[] secretKeyBytes;

  public SecurityTokenService(
    @Value("${syncstream.security.token-secret:}") String configuredSecret
  ) {
    if (configuredSecret != null && !configuredSecret.isBlank()) {
      this.secretKeyBytes = configuredSecret.getBytes(StandardCharsets.UTF_8);
    } else {
      // Generate a cryptographically secure 256-bit ephemeral secret key for this server instance
      byte[] randomBytes = new byte[32];
      new SecureRandom().nextBytes(randomBytes);
      this.secretKeyBytes = randomBytes;
      logger.info("Initialized SecurityTokenService with a secure ephemeral instance key.");
    }
  }

  /**
   * Generates a signed token for a given room and role: HMAC(roomId + ":" + role)
   *
   * @param roomId the room identifier
   * @param role the user role (owner, admin, editor, viewer)
   * @return URL-safe Base64 encoded signature token
   */
  public String generateRoleToken(String roomId, String role) {
    if (roomId == null || role == null) {
      return "";
    }

    try {
      Mac mac = Mac.getInstance(HMAC_ALGORITHM);
      SecretKeySpec keySpec = new SecretKeySpec(secretKeyBytes, HMAC_ALGORITHM);
      mac.init(keySpec);

      String payload = roomId + ":" + role.toLowerCase().trim();
      byte[] rawHmac = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));

      return Base64.getUrlEncoder().withoutPadding().encodeToString(rawHmac);
    } catch (Exception e) {
      logger.error("Failed to generate role token", e);
      return "";
    }
  }

  /**
   * Verifies whether a token is valid for the specified room and role.
   * Uses constant-time comparison to prevent timing side-channel attacks.
   *
   * @param roomId the room identifier
   * @param role the role claimed by the client
   * @param token the token supplied by the client
   * @return true if valid, false otherwise
   */
  public boolean verifyRoleToken(String roomId, String role, String token) {
    if (roomId == null || role == null || token == null || token.isBlank()) {
      return false;
    }

    String expectedToken = generateRoleToken(roomId, role);
    if (expectedToken.isEmpty()) {
      return false;
    }

    byte[] a = expectedToken.getBytes(StandardCharsets.UTF_8);
    byte[] b = token.trim().getBytes(StandardCharsets.UTF_8);

    // Constant-time comparison
    return MessageDigest.isEqual(a, b);
  }
}
