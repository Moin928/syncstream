package com.syncstream.backend.services;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.security.spec.InvalidKeySpecException;
import java.util.Base64;

/**
 * Provides cryptographically secure password hashing and constant-time verification
 * using PBKDF2 with HMAC-SHA256 (65,536 iterations).
 */
@Service
public class PasswordService {

  private static final Logger logger = LoggerFactory.getLogger(PasswordService.class);

  private static final String ALGORITHM = "PBKDF2WithHmacSHA256";
  private static final int ITERATIONS = 65_536;
  private static final int KEY_LENGTH = 256;
  private static final int SALT_BYTES = 16;

  private final SecureRandom secureRandom = new SecureRandom();

  /**
   * Generates a cryptographically secure random salt.
   */
  public String generateSalt() {
    byte[] salt = new byte[SALT_BYTES];
    secureRandom.nextBytes(salt);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(salt);
  }

  /**
   * Hashes a plaintext password using PBKDF2 and the provided salt.
   */
  public String hashPassword(String password, String salt) {
    if (password == null || salt == null) {
      throw new IllegalArgumentException("Password and salt must not be null");
    }

    try {
      byte[] saltBytes = Base64.getUrlDecoder().decode(salt);
      PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), saltBytes, ITERATIONS, KEY_LENGTH);
      SecretKeyFactory skf = SecretKeyFactory.getInstance(ALGORITHM);
      byte[] hash = skf.generateSecret(spec).getEncoded();
      return Base64.getUrlEncoder().withoutPadding().encodeToString(hash);
    } catch (NoSuchAlgorithmException | InvalidKeySpecException e) {
      logger.error("Error hashing password with algorithm: {}", ALGORITHM, e);
      throw new IllegalStateException("Failed to hash password", e);
    }
  }

  /**
   * Constant-time comparison between entered password and stored hash.
   */
  public boolean verifyPassword(String enteredPassword, String storedHash, String storedSalt) {
    if (enteredPassword == null || storedHash == null || storedSalt == null) {
      return false;
    }

    try {
      String calculatedHash = hashPassword(enteredPassword, storedSalt);
      byte[] a = calculatedHash.getBytes(java.nio.charset.StandardCharsets.UTF_8);
      byte[] b = storedHash.getBytes(java.nio.charset.StandardCharsets.UTF_8);

      return MessageDigest.isEqual(a, b);
    } catch (Exception e) {
      logger.error("Error verifying password", e);
      return false;
    }
  }
}
