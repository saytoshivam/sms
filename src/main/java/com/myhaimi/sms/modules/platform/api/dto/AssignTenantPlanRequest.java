package com.myhaimi.sms.modules.platform.api.dto;

import jakarta.validation.constraints.NotBlank;

public record AssignTenantPlanRequest(@NotBlank String planCode) {}
