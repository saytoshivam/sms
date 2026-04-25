package com.myhaimi.sms.DTO.announcement;

import com.myhaimi.sms.entity.AnnouncementAudience;
import com.myhaimi.sms.entity.AnnouncementCategory;

import java.time.Instant;

public record AnnouncementListItemDTO(
        int id,
        String title,
        AnnouncementCategory category,
        String referenceCode,
        Instant createdAt,
        AnnouncementAudience audience
) {}
