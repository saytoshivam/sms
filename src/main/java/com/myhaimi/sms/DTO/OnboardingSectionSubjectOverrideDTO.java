package com.myhaimi.sms.DTO;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/** Section-level overrides: nullable values fall back to the class template. */
public record OnboardingSectionSubjectOverrideDTO(
        @NotNull Integer classGroupId,
        @NotNull Integer subjectId,
        @Positive Integer periodsPerWeek,
        Integer teacherId,
        Integer roomId
) {}

