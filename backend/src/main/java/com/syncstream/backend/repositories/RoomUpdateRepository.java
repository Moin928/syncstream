package com.syncstream.backend.repositories;

import com.syncstream.backend.models.RoomUpdate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RoomUpdateRepository
  extends JpaRepository<RoomUpdate, Long> {

  // gets all updates for a room in the order they were created
  List<RoomUpdate> findByRoomIdOrderByIdAsc(
    String roomId
  );

  // gets the most recent update for a room
  Optional<RoomUpdate> findTopByRoomIdOrderByIdDesc(
    String roomId
  );

  // gets updates created after a specific update id
  List<RoomUpdate> findByRoomIdAndIdGreaterThanOrderByIdAsc(
    String roomId,
    long id
  );

  // removes old updates after they are no longer needed for recovery
  void deleteByRoomIdAndIdLessThanEqual(
    String roomId,
    long id
  );
}
