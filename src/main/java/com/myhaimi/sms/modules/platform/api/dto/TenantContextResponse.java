package com.myhaimi.sms.modules.platform.api.dto;

public record TenantContextResponse(
        Integer tenantId,
        String tenantCode,
        String tenantName,
        String principalEmail
) {}
