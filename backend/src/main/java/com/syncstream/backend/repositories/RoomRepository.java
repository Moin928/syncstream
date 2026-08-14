package com.syncstream.backend.repositories;

import com.syncstream.backend.models.Room;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoomRepository
  extends JpaRepository<Room, String> {
}
