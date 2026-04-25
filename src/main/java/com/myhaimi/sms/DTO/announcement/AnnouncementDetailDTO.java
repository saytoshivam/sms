package com.myhaimi.sms.DTO.announcement;

import com.myhaimi.sms.entity.AnnouncementAudience;
import com.myhaimi.sms.entity.AnnouncementCategory;

import java.time.Instant;
import java.util.List;

public record AnnouncementDetailDTO(
        int id,
        String title,
        AnnouncementCategory category,
        String referenceCode,
        Instant createdAt,
        String body,
        AnnouncementAudience audience,
        String authorDisplay,
        List<String> targetClassLabels
) {}
