package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.staff.importdto.StaffImportRowDto;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory store for staff import sessions (same pattern as StudentImportTokenStore).
 * Sessions expire after 30 minutes; evicted every 10 minutes.
 */
@Slf4j
@Component
public class StaffImportTokenStore {

    private static final long TTL_MS = 30 * 60 * 1000L;

    private record Session(Integer schoolId, List<StaffImportRowDto> validRows, Instant expiresAt) {}

    private final Map<String, Session> store = new ConcurrentHashMap<>();

    public String store(Integer schoolId, List<StaffImportRowDto> validRows) {
        String token = UUID.randomUUID().toString();
        store.put(token, new Session(schoolId, validRows, Instant.now().plusMillis(TTL_MS)));
        return token;
    }

    public Optional<List<StaffImportRowDto>> consume(String token, Integer schoolId) {
        Session session = store.remove(token);
        if (session == null)                          return Optional.empty();
        if (Instant.now().isAfter(session.expiresAt())) return Optional.empty();
        if (!session.schoolId().equals(schoolId))      return Optional.empty();
        return Optional.of(session.validRows());
    }

    public void discard(String token) { store.remove(token); }

    @Scheduled(fixedDelay = 10 * 60 * 1000L)
    public void evictExpired() {
        Instant now = Instant.now();
        int removed = (int) store.entrySet().stream()
                .filter(e -> now.isAfter(e.getValue().expiresAt()))
                .peek(e -> store.remove(e.getKey()))
                .count();
        if (removed > 0) log.info("Staff import store: evicted {} expired session(s).", removed);
    }
}

