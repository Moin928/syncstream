package com.syncstream.backend.models;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "users", indexes = {
  @Index(name = "idx_users_username", columnList = "username", unique = true),
  @Index(name = "idx_users_email", columnList = "email", unique = true)
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class User {

  @Id
  @Column(length = 36, nullable = false, updatable = false)
  private String id;

  @Column(nullable = false, unique = true, length = 32)
  private String username;

  @Column(nullable = false, unique = true, length = 100)
  private String email;

  @Column(nullable = false, length = 128)
  private String passwordHash;

  @Column(nullable = false, length = 64)
  private String salt;

  @Setter
  @Column(length = 64)
  private String displayName;

  @Setter
  @Column(length = 255)
  private String avatar;

  @Column(nullable = false)
  private Instant createdAt;

  @Column(nullable = false)
  private Instant updatedAt;

  public User(String username, String email, String passwordHash, String salt, String displayName) {
    this.id = UUID.randomUUID().toString();
    this.username = username.toLowerCase().trim();
    this.email = email.toLowerCase().trim();
    this.passwordHash = passwordHash;
    this.salt = salt;
    this.displayName = displayName != null && !displayName.isBlank() ? displayName.trim() : username;
    this.avatar = "";
    this.createdAt = Instant.now();
    this.updatedAt = Instant.now();
  }

  public void updatePassword(String passwordHash, String salt) {
    this.passwordHash = passwordHash;
    this.salt = salt;
    this.updatedAt = Instant.now();
  }

  public void updateProfile(String displayName, String avatar) {
    if (displayName != null && !displayName.isBlank()) {
      this.displayName = displayName.trim();
    }
    if (avatar != null) {
      this.avatar = avatar.trim();
    }
    this.updatedAt = Instant.now();
  }
}
