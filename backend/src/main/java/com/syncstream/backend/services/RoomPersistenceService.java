package com.syncstream.backend.services;

import com.syncstream.backend.models.Room;
import com.syncstream.backend.models.RoomUpdate;
import com.syncstream.backend.repositories.RoomRepository;
import com.syncstream.backend.repositories.RoomUpdateRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class RoomPersistenceService {

  private final RoomRepository roomRepository;
  private final RoomUpdateRepository roomUpdateRepository;

  public RoomPersistenceService(
    RoomRepository roomRepository,
    RoomUpdateRepository roomUpdateRepository
  ) {
    this.roomRepository = roomRepository;
    this.roomUpdateRepository = roomUpdateRepository;
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
  public void saveUpdate(
    String roomId,
    byte[] update,
    long sequence
  ) {
    Room room =
      getOrCreateRoom(roomId);

    RoomUpdate roomUpdate =
      new RoomUpdate(
        room,
        update,
        sequence
      );

    roomUpdateRepository.save(
      roomUpdate
    );
  }

  @Transactional(readOnly = true)
  public List<byte[]> loadUpdates(
    String roomId
  ) {
    return roomUpdateRepository
      .findByRoomIdOrderBySequenceAsc(roomId)
      .stream()
      .map(RoomUpdate::getUpdateData)
      .toList();
  }
}
