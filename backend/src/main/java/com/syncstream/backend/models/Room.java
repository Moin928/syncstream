package com.syncstream.backend.models;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "rooms")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Room {

  @Id
  @Column(length = 64, nullable = false, updatable = false)
  private String id;

  @Setter
  @Column(length = 36, nullable = true)
  private String ownerId;

  @Setter
  @Column(nullable = false)
  private boolean isGuest;

  @Column(nullable = false)
  private Instant createdAt;

  @Column(nullable = false)
  private Instant updatedAt;

  public Room(String id) {
    this(id, null, true);
  }

  public Room(String id, String ownerId, boolean isGuest) {
    this.id = id;
    this.ownerId = ownerId;
    this.isGuest = isGuest;
    this.createdAt = Instant.now();
    this.updatedAt = Instant.now();
  }

  public void updateTimestamp() {
    // updates the timestamp whenever something changes in the room
    this.updatedAt = Instant.now();
  }
}
