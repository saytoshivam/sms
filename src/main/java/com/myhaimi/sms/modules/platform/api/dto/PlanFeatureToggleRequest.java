package com.myhaimi.sms.modules.platform.api.dto;

import jakarta.validation.constraints.NotNull;

public record PlanFeatureToggleRequest(@NotNull Boolean enabled) {}
