package com.syncstream.backend.dto;

import com.syncstream.backend.models.User;

import java.time.Instant;

public class AuthDto {

  public record RegisterRequest(
    String username,
    String email,
    String password,
    String displayName
  ) {}

  public record LoginRequest(
    String usernameOrEmail,
    String password
  ) {}

  public record UpdateProfileRequest(
    String displayName,
    String avatar
  ) {}

  public record UserDto(
    String id,
    String username,
    String email,
    String displayName,
    String avatar,
    Instant createdAt
  ) {
    public static UserDto fromEntity(User user) {
      return new UserDto(
        user.getId(),
        user.getUsername(),
        user.getEmail(),
        user.getDisplayName(),
        user.getAvatar(),
        user.getCreatedAt()
      );
    }
  }

  public record AuthResponse(
    String token,
    UserDto user,
    String message
  ) {}
}
