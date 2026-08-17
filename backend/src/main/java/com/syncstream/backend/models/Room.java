package com.syncstream.backend.models;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity
@Table(name = "rooms")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Room {

  @Id
  private String id;

  private Instant createdAt;

  private Instant updatedAt;

  public Room(String id) {
    this.id = id;
    this.createdAt = Instant.now();
    this.updatedAt = Instant.now();
  }

  public void updateTimestamp() {
    // updates the timestamp whenever something changes in the room
    this.updatedAt = Instant.now();
  }
}
