package com.syncstream.backend.repositories;

import com.syncstream.backend.models.RoomDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;

public interface RoomDocumentRepository extends JpaRepository<RoomDocument, String> {

  void deleteByRoomId(String roomId);

  @Modifying
  @Query("DELETE FROM RoomDocument d WHERE d.room.isGuest = true AND d.room.updatedAt < :cutoff")
  void deleteDocumentsForExpiredGuestRooms(@Param("cutoff") Instant cutoff);
}
