package com.myhaimi.sms.modules.platform.api.dto;

import java.time.Instant;

public record AuditLogItemResponse(
        long id,
        Instant occurredAt,
        String actorEmail,
        String action,
        String resourceType,
        String resourceId,
        String detail) {}
