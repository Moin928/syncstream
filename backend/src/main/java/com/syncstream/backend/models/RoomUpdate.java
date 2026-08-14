package com.syncstream.backend.models;

import com.syncstream.backend.models.Room;
import jakarta.persistence.*;
import lombok.Data;

import java.time.Instant;

@Data
@Entity
@Table(name = "room_updates")
public class RoomUpdate {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "room_id", nullable = false)
  private Room room;

  @Lob
  @Column(nullable = false, columnDefinition = "LONGBLOB")
  private byte[] updateData;

  @Column(nullable = false)
  private Long sequence;

  @Column(nullable = false)
  private Instant createdAt;

  protected RoomUpdate() {
  }

  public RoomUpdate(
    Room room,
    byte[] updateData,
    Long sequence
  ) {
    this.room = room;
    this.updateData = updateData.clone();
    this.sequence = sequence;
    this.createdAt = Instant.now();
  }
}
