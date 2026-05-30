package com.myhaimi.sms.modules.exam.dto;

import jakarta.validation.constraints.NotNull;

public record ResultCalculationRequestDTO(
        @NotNull Integer classGroupId,
        @NotNull Integer schemeId,
        @NotNull Integer subjectId,
        /** Optional: use specific grading scheme. Falls back to the active scheme for the school/academic-year. */
        Integer gradingSchemeId
) {}

