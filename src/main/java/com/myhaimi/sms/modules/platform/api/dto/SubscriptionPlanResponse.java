package com.myhaimi.sms.modules.platform.api.dto;

public record SubscriptionPlanResponse(
        Long id,
        String planCode,
        String name,
        String description,
        Boolean active
) {}
