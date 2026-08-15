package com.syncstream.backend.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity
@Table(name = "room_documents")
@Getter
@NoArgsConstructor
public class RoomDocument {

  @Id
  private String roomId;

  @OneToOne(fetch = FetchType.LAZY, optional = false)
  @MapsId
  @JoinColumn(
    name = "room_id",
    nullable = false
  )
  private Room room;

  @Lob
  @Column(
    nullable = false,
    columnDefinition = "LONGBLOB"
  )
  private byte[] snapshotData;

  @Column(nullable = false)
  private long snapshotUpdateId;

  @Column(nullable = false)
  private Instant updatedAt;

  public RoomDocument(
    Room room,
    byte[] snapshotData,
    long snapshotUpdateId
  ) {
    this.room = room;
    this.snapshotData = snapshotData.clone();
    this.snapshotUpdateId = snapshotUpdateId;
    this.updatedAt = Instant.now();
  }

  public void updateSnapshot(
    byte[] snapshotData,
    long snapshotUpdateId
  ) {
    this.snapshotData = snapshotData.clone();
    this.snapshotUpdateId = snapshotUpdateId;
    this.updatedAt = Instant.now();
  }

  public byte[] getSnapshotData() {
    return snapshotData.clone();
  }
}
