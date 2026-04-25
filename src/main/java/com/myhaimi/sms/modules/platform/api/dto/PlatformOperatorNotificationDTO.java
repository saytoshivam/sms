package com.myhaimi.sms.modules.platform.api.dto;

public record PlatformOperatorNotificationDTO(
        long id,
        String createdAt,
        String kind,
        String title,
        String body,
        Integer tenantId,
        String actorEmail,
        String detail,
        boolean read) {}
