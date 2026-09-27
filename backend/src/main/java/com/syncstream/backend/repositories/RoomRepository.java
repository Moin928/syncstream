package com.syncstream.backend.repositories;

import com.syncstream.backend.models.Room;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface RoomRepository extends JpaRepository<Room, String> {

  List<Room> findByOwnerIdOrderByUpdatedAtDesc(String ownerId);

  List<Room> findByIsGuestTrueAndUpdatedAtBefore(Instant cutoff);

  @Modifying
  @Query("DELETE FROM Room r WHERE r.isGuest = true AND r.updatedAt < :cutoff")
  void deleteExpiredGuestRooms(@Param("cutoff") Instant cutoff);
}
