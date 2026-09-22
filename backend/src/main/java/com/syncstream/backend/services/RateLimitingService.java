package com.syncstream.backend.services;

import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * In-memory token-bucket rate limiting service for REST endpoints.
 * Protects against endpoint flooding and resource exhaustion DoS attacks.
 */
@Service
public class RateLimitingService {

  private record RateBucket(long windowStart, AtomicInteger counter) {}

  private final Map<String, RateBucket> ipBuckets = new ConcurrentHashMap<>();

  /**
   * Checks whether a request from a given client IP is allowed.
   *
   * @param clientIp the IP address of the caller
   * @param action the action identifier (e.g. "create_room")
   * @param maxRequests maximum allowed requests per window
   * @param windowMs window duration in milliseconds
   * @return true if allowed, false if rate limit exceeded
   */
  public boolean allowRequest(String clientIp, String action, int maxRequests, long windowMs) {
    if (clientIp == null || clientIp.isBlank()) {
      clientIp = "unknown";
    }

    String key = action + ":" + clientIp;
    long now = System.currentTimeMillis();

    RateBucket bucket = ipBuckets.compute(key, (k, existing) -> {
      if (existing == null || (now - existing.windowStart()) > windowMs) {
        return new RateBucket(now, new AtomicInteger(1));
      }
      existing.counter().incrementAndGet();
      return existing;
    });

    return bucket.counter().get() <= maxRequests;
  }

  /** Periodic cleanup of expired rate limit buckets to prevent memory leaks. */
  public void cleanupExpired(long windowMs) {
    long now = System.currentTimeMillis();
    ipBuckets.entrySet().removeIf(entry -> (now - entry.getValue().windowStart()) > windowMs * 2);
  }
}
