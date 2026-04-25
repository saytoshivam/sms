package com.myhaimi.sms.modules.platform.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record PlatformSchoolUpdateRequest(
        @NotBlank @Size(max = 256) String name,
        @NotBlank
                @Size(max = 64)
                @Pattern(regexp = "^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$", message = "code must be lowercase slug")
                String code) {}
