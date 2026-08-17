package com.syncstream.backend.controllers;

import com.syncstream.backend.models.Room;
import com.syncstream.backend.repositories.RoomRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/rooms")
@CrossOrigin(origins = "http://localhost:5173")
public class RoomController {

  private final RoomRepository roomRepository;

  public RoomController(
    RoomRepository roomRepository
  ) {
    this.roomRepository = roomRepository;
  }

  @PostMapping
  public ResponseEntity<String> createRoom() {

    // generates a unique id for the new room
    String roomId =
      UUID.randomUUID().toString();

    Room room =
      new Room(roomId);

    roomRepository.save(room);

    // returns the room id after it has been created
    return ResponseEntity
      .status(HttpStatus.CREATED)
      .body(roomId);
  }

  @GetMapping("/{roomId}")
  public ResponseEntity<Void> checkRoom(
    @PathVariable String roomId
  ) {

    // checks whether the requested room exists in the database
    if (!roomRepository.existsById(roomId)) {
      return ResponseEntity
        .notFound()
        .build();
    }

    return ResponseEntity.ok().build();
  }
}
