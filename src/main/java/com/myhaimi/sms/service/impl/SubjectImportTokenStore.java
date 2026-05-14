package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.subject.importdto.SubjectImportRowDto;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
public class SubjectImportTokenStore {

    private static final long TTL_MS = 30 * 60 * 1000L;

    private record ImportSession(Integer schoolId, List<SubjectImportRowDto> validRows, Instant expiresAt) {}

    private final Map<String, ImportSession> store = new ConcurrentHashMap<>();

    public String store(Integer schoolId, List<SubjectImportRowDto> validRows) {
        String token = UUID.randomUUID().toString();
        store.put(token, new ImportSession(schoolId, validRows, Instant.now().plusMillis(TTL_MS)));
        return token;
    }

    public Optional<List<SubjectImportRowDto>> consume(String token, Integer schoolId) {
        ImportSession session = store.remove(token);
        if (session == null) return Optional.empty();
        if (Instant.now().isAfter(session.expiresAt())) return Optional.empty();
        if (!session.schoolId().equals(schoolId)) return Optional.empty();
        return Optional.of(session.validRows());
    }

    public void discard(String token) { store.remove(token); }

    @Scheduled(fixedDelay = 10 * 60 * 1000L)
    public void evictExpired() {
        Instant now = Instant.now();
        int removed = 0;
        for (Map.Entry<String, ImportSession> e : store.entrySet()) {
            if (now.isAfter(e.getValue().expiresAt())) { store.remove(e.getKey()); removed++; }
        }
        if (removed > 0) log.info("SubjectImportTokenStore: evicted {} expired session(s).", removed);
    }
}

