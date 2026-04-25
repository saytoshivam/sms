package com.myhaimi.sms.modules.platform.api.dto;

import jakarta.validation.constraints.Size;

public record PlatformFeatureFlagUpdateRequest(Boolean enabled, @Size(max = 512) String description) {}
