package com.myhaimi.sms.DTO;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/** Grade-level template: applies to all sections in the grade. */
public record OnboardingClassSubjectConfigDTO(
        @NotNull Integer gradeLevel,
        @NotNull Integer subjectId,
        @NotNull @Positive Integer defaultPeriodsPerWeek,
        Integer defaultTeacherId,
        Integer defaultRoomId
) {}

