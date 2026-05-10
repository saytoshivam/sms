package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.student.importdto.StudentImportRowDto;
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
 * In-memory store that maps import tokens to validated row lists.
 *
 * <p>Sessions expire after 30 minutes. An {@link @Scheduled} task sweeps
 * expired entries every 10 minutes so the map never accumulates stale data.
 * </p>
 */
@Slf4j
@Component
public class StudentImportTokenStore {

    /** TTL: 30 minutes in milliseconds. */
    private static final long TTL_MS = 30 * 60 * 1000L;

    private record ImportSession(
            Integer schoolId,
            List<StudentImportRowDto> validRows,
            Instant expiresAt
    ) {}

    private final Map<String, ImportSession> store = new ConcurrentHashMap<>();

    /** Persist validated rows and return the access token. */
    public String store(Integer schoolId, List<StudentImportRowDto> validRows) {
        String token = UUID.randomUUID().toString();
        store.put(token, new ImportSession(schoolId, validRows, Instant.now().plusMillis(TTL_MS)));
        return token;
    }

    /**
     * Retrieve and remove the session.
     *
     * @param token   the import token
     * @param schoolId must match the school that created the session
     * @return valid rows, or empty if expired / not found / school mismatch
     */
    public Optional<List<StudentImportRowDto>> consume(String token, Integer schoolId) {
        ImportSession session = store.remove(token);
        if (session == null) return Optional.empty();
        if (Instant.now().isAfter(session.expiresAt())) return Optional.empty();
        if (!session.schoolId().equals(schoolId)) return Optional.empty();
        return Optional.of(session.validRows());
    }

    /** Discard an unused token explicitly (e.g., user cancelled). */
    public void discard(String token) {
        store.remove(token);
    }

    /** Sweep expired sessions every 10 minutes. */
    @Scheduled(fixedDelay = 10 * 60 * 1000L)
    public void evictExpired() {
        Instant now = Instant.now();
        int removed = 0;
        for (Map.Entry<String, ImportSession> entry : store.entrySet()) {
            if (now.isAfter(entry.getValue().expiresAt())) {
                store.remove(entry.getKey());
                removed++;
            }
        }
        if (removed > 0) {
            log.info("Import token store: evicted {} expired session(s).", removed);
        }
    }
}
