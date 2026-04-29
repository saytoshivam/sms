package com.myhaimi.sms.DTO;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ClassGroupUpdateDTO(
        @NotBlank
        @Pattern(regexp = "^[A-Za-z0-9]+(?:[-_][A-Za-z0-9]+)*$", message = "Code must be a simple identifier like '10-A' or 'nursery_blue'")
        String code,

        @NotBlank
        String displayName,

        Integer gradeLevel,

        @Size(max = 16)
        String section,

        Integer capacity
) {}

