package com.myhaimi.sms.modules.platform.api.dto;

import java.time.Instant;

public record ApiErrorResponse(
        String traceId,
        String code,
        String message,
        Instant timestamp
) {}
