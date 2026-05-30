package com.myhaimi.sms.modules.exam.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AssessmentSchemeUpdateDTO(
        @NotBlank @Size(max = 128) String name,
        @Size(max = 2000) String description
) {}
