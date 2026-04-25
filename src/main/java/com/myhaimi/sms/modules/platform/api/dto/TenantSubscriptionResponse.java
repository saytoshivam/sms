package com.myhaimi.sms.modules.platform.api.dto;

import java.time.Instant;

public record TenantSubscriptionResponse(
        Integer tenantId,
        String planCode,
        String planName,
        String status,
        Instant startsAt,
        Instant endsAt
) {
    public static TenantSubscriptionResponse platform() {
        return new TenantSubscriptionResponse(null, "PLATFORM", "MyHaimi Platform", "ACTIVE", null, null);
    }

    public static TenantSubscriptionResponse none(int tenantId) {
        return new TenantSubscriptionResponse(tenantId, null, null, "NONE", null, null);
    }
}
