package com.syncstream.backend.services;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Service for issuing, signing, parsing and validating HMAC-SHA256 JWT tokens.
 */
@Service
public class JwtTokenService {

  private static final Logger logger = LoggerFactory.getLogger(JwtTokenService.class);
  private static final String HMAC_ALGORITHM = "HmacSHA256";
  private static final long DEFAULT_EXPIRATION_SECONDS = 7 * 24 * 60 * 60; // 7 days

  private final byte[] secretKeyBytes;
  private final ObjectMapper objectMapper;

  public JwtTokenService(
    @Value("${syncstream.jwt.secret:}") String configuredSecret,
    ObjectMapper objectMapper
  ) {
    this.objectMapper = objectMapper;
    if (configuredSecret != null && !configuredSecret.isBlank()) {
      this.secretKeyBytes = configuredSecret.getBytes(StandardCharsets.UTF_8);
    } else {
      byte[] randomBytes = new byte[32];
      new SecureRandom().nextBytes(randomBytes);
      this.secretKeyBytes = randomBytes;
      logger.info("Initialized JwtTokenService with secure ephemeral secret key.");
    }
  }

  public record JwtUserClaims(
    String userId,
    String username,
    String email,
    String displayName,
    Instant issuedAt,
    Instant expiresAt
  ) {}

  /**
   * Generates a signed JWT token for the specified user.
   */
  public String generateToken(String userId, String username, String email, String displayName) {
    try {
      Instant now = Instant.now();
      Instant expiresAt = now.plusSeconds(DEFAULT_EXPIRATION_SECONDS);

      // Header
      Map<String, Object> header = Map.of(
        "alg", "HS256",
        "typ", "JWT"
      );
      String headerJson = objectMapper.writeValueAsString(header);
      String encodedHeader = Base64.getUrlEncoder().withoutPadding().encodeToString(headerJson.getBytes(StandardCharsets.UTF_8));

      // Payload / Claims
      Map<String, Object> claims = new HashMap<>();
      claims.put("sub", userId);
      claims.put("username", username);
      claims.put("email", email);
      if (displayName != null) {
        claims.put("displayName", displayName);
      }
      claims.put("iat", now.getEpochSecond());
      claims.put("exp", expiresAt.getEpochSecond());

      String payloadJson = objectMapper.writeValueAsString(claims);
      String encodedPayload = Base64.getUrlEncoder().withoutPadding().encodeToString(payloadJson.getBytes(StandardCharsets.UTF_8));

      // Signature
      String dataToSign = encodedHeader + "." + encodedPayload;
      String signature = sign(dataToSign);

      return dataToSign + "." + signature;
    } catch (Exception e) {
      logger.error("Failed to generate JWT token for user: {}", username, e);
      throw new IllegalStateException("Failed to generate token", e);
    }
  }

  /**
   * Verifies a JWT token signature and expiry, returning parsed claims if valid.
   */
  public Optional<JwtUserClaims> validateAndParseToken(String token) {
    if (token == null || token.isBlank()) {
      return Optional.empty();
    }

    // Strip "Bearer " prefix if included
    String cleanToken = token.startsWith("Bearer ") ? token.substring(7).trim() : token.trim();
    String[] parts = cleanToken.split("\\.");
    if (parts.length != 3) {
      return Optional.empty();
    }

    String headerPart = parts[0];
    String payloadPart = parts[1];
    String signaturePart = parts[2];

    try {
      // 1. Verify Signature
      String dataToSign = headerPart + "." + payloadPart;
      String expectedSignature = sign(dataToSign);

      byte[] expectedSigBytes = expectedSignature.getBytes(StandardCharsets.UTF_8);
      byte[] actualSigBytes = signaturePart.getBytes(StandardCharsets.UTF_8);

      if (!MessageDigest.isEqual(expectedSigBytes, actualSigBytes)) {
        logger.debug("JWT signature mismatch");
        return Optional.empty();
      }

      // 2. Decode and parse payload
      byte[] payloadBytes = Base64.getUrlDecoder().decode(payloadPart);
      @SuppressWarnings("unchecked")
      Map<String, Object> claims = objectMapper.readValue(payloadBytes, Map.class);

      String userId = (String) claims.get("sub");
      String username = (String) claims.get("username");
      String email = (String) claims.get("email");
      String displayName = (String) claims.get("displayName");
      Number expNum = (Number) claims.get("exp");
      Number iatNum = (Number) claims.get("iat");

      if (userId == null || username == null || expNum == null) {
        return Optional.empty();
      }

      Instant expiresAt = Instant.ofEpochSecond(expNum.longValue());
      Instant issuedAt = iatNum != null ? Instant.ofEpochSecond(iatNum.longValue()) : Instant.now();

      // Check expiry
      if (Instant.now().isAfter(expiresAt)) {
        logger.debug("JWT token expired at {}", expiresAt);
        return Optional.empty();
      }

      return Optional.of(new JwtUserClaims(userId, username, email, displayName, issuedAt, expiresAt));
    } catch (Exception e) {
      logger.debug("Failed to parse or validate JWT: {}", e.getMessage());
      return Optional.empty();
    }
  }

  private String sign(String data) throws Exception {
    Mac mac = Mac.getInstance(HMAC_ALGORITHM);
    SecretKeySpec keySpec = new SecretKeySpec(secretKeyBytes, HMAC_ALGORITHM);
    mac.init(keySpec);
    byte[] rawHmac = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
    return Base64.getUrlEncoder().withoutPadding().encodeToString(rawHmac);
  }
}
