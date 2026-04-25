package com.myhaimi.sms.modules.platform.api.dto;

public record PlatformFeatureFlagResponse(long id, String flagKey, boolean enabled, String description) {}
