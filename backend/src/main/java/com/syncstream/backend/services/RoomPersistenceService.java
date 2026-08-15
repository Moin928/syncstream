package com.syncstream.backend.services;

import com.syncstream.backend.models.Room;
import com.syncstream.backend.models.RoomDocument;
import com.syncstream.backend.models.RoomUpdate;
import com.syncstream.backend.repositories.RoomDocumentRepository;
import com.syncstream.backend.repositories.RoomRepository;
import com.syncstream.backend.repositories.RoomUpdateRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class RoomPersistenceService {

  public record RecoveryState(
    byte[] snapshotData,
    long snapshotUpdateId,
    List<RoomUpdate> updates
  ) {}

  private final RoomRepository roomRepository;
  private final RoomUpdateRepository roomUpdateRepository;
  private final RoomDocumentRepository roomDocumentRepository;

  public RoomPersistenceService(
    RoomRepository roomRepository,
    RoomUpdateRepository roomUpdateRepository,
    RoomDocumentRepository roomDocumentRepository
  ) {
    this.roomRepository = roomRepository;
    this.roomUpdateRepository = roomUpdateRepository;
    this.roomDocumentRepository = roomDocumentRepository;
  }

  @Transactional
  public Room getOrCreateRoom(String roomId) {
    return roomRepository
      .findById(roomId)
      .orElseGet(() ->
        roomRepository.save(
          new Room(roomId)
        )
      );
  }

  @Transactional
  public long saveUpdate(
    String roomId,
    byte[] update
  ) {
    Room room =
      getOrCreateRoom(roomId);

    RoomUpdate roomUpdate =
      new RoomUpdate(
        room,
        update
      );

    RoomUpdate savedUpdate =
      roomUpdateRepository.save(
        roomUpdate
      );

    return savedUpdate.getId();
  }

  @Transactional
  public void saveSnapshot(
    String roomId,
    byte[] snapshotData,
    long snapshotUpdateId
  ) {
    Room room =
      getOrCreateRoom(roomId);

    Optional<RoomDocument> existingDocument =
      roomDocumentRepository.findById(roomId);

    if (existingDocument.isPresent()) {
      existingDocument
        .get()
        .updateSnapshot(
          snapshotData,
          snapshotUpdateId
        );
    } else {
      RoomDocument document =
        new RoomDocument(
          room,
          snapshotData,
          snapshotUpdateId
        );

      roomDocumentRepository.save(document);
    }

    roomUpdateRepository
      .deleteByRoomIdAndIdLessThanEqual(
        roomId,
        snapshotUpdateId
      );
  }

  @Transactional(readOnly = true)
  public long getLatestUpdateId(
    String roomId
  ) {
    return roomUpdateRepository
      .findTopByRoomIdOrderByIdDesc(roomId)
      .map(RoomUpdate::getId)
      .orElse(0L);
  }

  @Transactional(readOnly = true)
  public RecoveryState loadRecoveryState(
    String roomId
  ) {
    Optional<RoomDocument> snapshot =
      roomDocumentRepository.findById(roomId);

    if (snapshot.isEmpty()) {
      return new RecoveryState(
        null,
        0L,
        roomUpdateRepository
          .findByRoomIdOrderByIdAsc(roomId)
      );
    }

    RoomDocument document =
      snapshot.get();

    List<RoomUpdate> updates =
      roomUpdateRepository
        .findByRoomIdAndIdGreaterThanOrderByIdAsc(
          roomId,
          document.getSnapshotUpdateId()
        );

    return new RecoveryState(
      document.getSnapshotData(),
      document.getSnapshotUpdateId(),
      updates
    );
  }

}
