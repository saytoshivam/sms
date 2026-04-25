package com.myhaimi.sms.modules.platform.api.dto;

import java.time.Instant;

public record PlatformAnnouncementResponse(
        long id, String title, String body, boolean published, Instant createdAt, Instant updatedAt) {}
