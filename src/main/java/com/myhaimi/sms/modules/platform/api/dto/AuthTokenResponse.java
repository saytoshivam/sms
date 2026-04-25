package com.myhaimi.sms.modules.platform.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record AuthTokenResponse(
        String accessToken,
        String refreshToken,
        long expiresInMs,
        String tokenType
) {}
