package com.myhaimi.sms.modules.platform.api.dto;

import jakarta.validation.constraints.NotNull;

public record GloballyEnabledPatchRequest(@NotNull Boolean globallyEnabled) {}
