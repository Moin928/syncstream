package com.syncstream.backend.repositories;

import com.syncstream.backend.models.RoomUpdate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RoomUpdateRepository
  extends JpaRepository<RoomUpdate, Long> {

  List<RoomUpdate> findByRoomIdOrderByIdAsc(
    String roomId
  );

  Optional<RoomUpdate> findTopByRoomIdOrderByIdDesc(
    String roomId
  );

  List<RoomUpdate> findByRoomIdAndIdGreaterThanOrderByIdAsc(
    String roomId,
    long id
  );

  void deleteByRoomIdAndIdLessThanEqual(
    String roomId,
    long id
  );
}
