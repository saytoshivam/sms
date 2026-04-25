package com.myhaimi.sms.DTO;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record TenantPlanChangeRequestDTO(
        @NotBlank @Size(max = 64) String targetPlanCode,
        @Size(max = 2000) String message) {}
