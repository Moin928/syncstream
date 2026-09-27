package com.syncstream.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.syncstream.backend.services.JwtTokenService;
import com.syncstream.backend.services.PasswordService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class AuthServiceTests {

  private PasswordService passwordService;
  private JwtTokenService jwtTokenService;

  @BeforeEach
  void setUp() {
    passwordService = new PasswordService();
    jwtTokenService = new JwtTokenService("test-secret-key-for-jwt-signing-1234567890", new ObjectMapper());
  }

  @Test
  void testPasswordHashingAndVerification() {
    String password = "MySecurePassword123!";
    String salt = passwordService.generateSalt();
    assertNotNull(salt);
    assertFalse(salt.isBlank());

    String hash = passwordService.hashPassword(password, salt);
    assertNotNull(hash);
    assertFalse(hash.isBlank());

    assertTrue(passwordService.verifyPassword(password, hash, salt));
    assertFalse(passwordService.verifyPassword("WrongPassword", hash, salt));
    assertFalse(passwordService.verifyPassword(password, "WrongHash", salt));
  }

  @Test
  void testJwtTokenGenerationAndValidation() {
    String userId = "user-123-uuid";
    String username = "alex_dev";
    String email = "alex@example.com";
    String displayName = "Alex Developer";

    String token = jwtTokenService.generateToken(userId, username, email, displayName);
    assertNotNull(token);
    assertTrue(token.contains("."));

    Optional<JwtTokenService.JwtUserClaims> claimsOpt = jwtTokenService.validateAndParseToken(token);
    assertTrue(claimsOpt.isPresent());

    JwtTokenService.JwtUserClaims claims = claimsOpt.get();
    assertEquals(userId, claims.userId());
    assertEquals(username, claims.username());
    assertEquals(email, claims.email());
    assertEquals(displayName, claims.displayName());
  }

  @Test
  void testInvalidJwtToken() {
    assertFalse(jwtTokenService.validateAndParseToken("invalid.token.here").isPresent());
    assertFalse(jwtTokenService.validateAndParseToken("").isPresent());
    assertFalse(jwtTokenService.validateAndParseToken(null).isPresent());
  }
}
