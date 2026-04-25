package com.myhaimi.sms.DTO.timetable.v2;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record AutoFillRequestDTO(
        @NotNull Integer timetableVersionId,
        @NotNull Integer classGroupId,
        /** FILL_EMPTY (default) or REPLACE */
        @NotBlank String mode
) {}

