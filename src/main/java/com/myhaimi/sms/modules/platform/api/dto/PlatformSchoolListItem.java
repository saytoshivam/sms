package com.myhaimi.sms.modules.platform.api.dto;

import java.time.Instant;

/**
 * Super-admin directory row: tenant school plus subscription summary.
 */
public record PlatformSchoolListItem(
        int schoolId,
        String name,
        String code,
        Instant registeredAt,
        String planCode,
        String planName,
        String subscriptionStatus,
        boolean archived,
        long studentCount) {}
