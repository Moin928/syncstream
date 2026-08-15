package com.syncstream.backend.repositories;

import com.syncstream.backend.models.RoomDocument;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoomDocumentRepository
  extends JpaRepository<RoomDocument, String> {
}
