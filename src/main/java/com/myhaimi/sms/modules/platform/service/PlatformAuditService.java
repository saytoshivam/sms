package com.myhaimi.sms.modules.platform.service;

import com.myhaimi.sms.modules.platform.domain.AuditLog;
import com.myhaimi.sms.modules.platform.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
@RequiredArgsConstructor
public class PlatformAuditService {

    private final AuditLogRepository auditLogRepository;

    @Transactional
    public void record(String action, String resourceType, String resourceId, String detail) {
        String actor = null;
        if (SecurityContextHolder.getContext().getAuthentication() != null) {
            actor = SecurityContextHolder.getContext().getAuthentication().getName();
        }
        AuditLog row = new AuditLog();
        row.setOccurredAt(Instant.now());
        row.setActorEmail(actor);
        row.setAction(action);
        row.setResourceType(resourceType);
        row.setResourceId(resourceId);
        row.setDetail(detail);
        auditLogRepository.save(row);
    }
}
