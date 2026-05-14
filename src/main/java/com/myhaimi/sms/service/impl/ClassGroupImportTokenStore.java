package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.classgroup.importdto.ClassGroupImportRowDto;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
public class ClassGroupImportTokenStore {

    private static final long TTL_MS = 30 * 60 * 1000L;
    private record ImportSession(Integer schoolId, List<ClassGroupImportRowDto> validRows, Instant expiresAt) {}
    private final Map<String, ImportSession> store = new ConcurrentHashMap<>();

    public String store(Integer schoolId, List<ClassGroupImportRowDto> validRows) {
        String token = UUID.randomUUID().toString();
        store.put(token, new ImportSession(schoolId, validRows, Instant.now().plusMillis(TTL_MS)));
        return token;
    }

    public Optional<List<ClassGroupImportRowDto>> consume(String token, Integer schoolId) {
        ImportSession session = store.remove(token);
        if (session == null) return Optional.empty();
        if (Instant.now().isAfter(session.expiresAt())) return Optional.empty();
        if (!session.schoolId().equals(schoolId)) return Optional.empty();
        return Optional.of(session.validRows());
    }

    public void discard(String token) { store.remove(token); }

    @Scheduled(fixedDelay = 10 * 60 * 1000L)
    public void evictExpired() {
        Instant now = Instant.now(); int removed = 0;
        for (Map.Entry<String, ImportSession> e : store.entrySet())
            if (now.isAfter(e.getValue().expiresAt())) { store.remove(e.getKey()); removed++; }
        if (removed > 0) log.info("ClassGroupImportTokenStore: evicted {} expired session(s).", removed);
    }
}

