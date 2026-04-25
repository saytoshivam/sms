package com.myhaimi.sms.modules.platform.api;

import com.myhaimi.sms.modules.platform.api.dto.AuditLogItemResponse;
import com.myhaimi.sms.modules.platform.domain.AuditLog;
import com.myhaimi.sms.modules.platform.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/platform/audit-logs")
@RequiredArgsConstructor
public class PlatformAuditLogV1Controller {

    private final AuditLogRepository auditLogRepository;

    @GetMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public Page<AuditLogItemResponse> page(@PageableDefault(size = 50) Pageable pageable) {
        return auditLogRepository.findAllByOrderByOccurredAtDesc(pageable).map(PlatformAuditLogV1Controller::toDto);
    }

    private static AuditLogItemResponse toDto(AuditLog a) {
        return new AuditLogItemResponse(
                a.getId(),
                a.getOccurredAt(),
                a.getActorEmail(),
                a.getAction(),
                a.getResourceType(),
                a.getResourceId(),
                a.getDetail());
    }
}
