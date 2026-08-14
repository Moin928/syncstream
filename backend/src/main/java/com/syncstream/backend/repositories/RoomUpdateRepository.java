package com.syncstream.backend.repositories;

import com.syncstream.backend.models.RoomUpdate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RoomUpdateRepository
  extends JpaRepository<RoomUpdate, Long> {

  List<RoomUpdate> findByRoomIdOrderBySequenceAsc(
    String roomId
  );
}
