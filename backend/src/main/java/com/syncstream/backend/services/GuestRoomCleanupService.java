package com.syncstream.backend.services;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;

/**
 * Periodically removes ephemeral guest rooms that have been inactive.
 * Ensures zero persistent storage is consumed by unauthenticated guest users.
 */
@Service
public class GuestRoomCleanupService {

  private static final Logger logger = LoggerFactory.getLogger(GuestRoomCleanupService.class);

  // Guest rooms with no activity for > 15 minutes are purged
  private static final Duration GUEST_ROOM_INACTIVITY_LIMIT = Duration.ofMinutes(15);

  private final RoomPersistenceService persistenceService;

  public GuestRoomCleanupService(RoomPersistenceService persistenceService) {
    this.persistenceService = persistenceService;
  }

  /**
   * Runs every 5 minutes to clean up inactive guest rooms.
   */
  @Scheduled(fixedRate = 300_000, initialDelay = 60_000)
  public void cleanupStaleGuestRooms() {
    Instant cutoff = Instant.now().minus(GUEST_ROOM_INACTIVITY_LIMIT);
    try {
      persistenceService.cleanupExpiredGuestRooms(cutoff);
    } catch (Exception e) {
      logger.error("Failed to execute scheduled guest room cleanup", e);
    }
  }
}
