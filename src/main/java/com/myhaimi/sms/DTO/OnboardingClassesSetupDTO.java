package com.myhaimi.sms.DTO;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record OnboardingClassesSetupDTO(
        @NotNull Integer fromGrade,
        @NotNull Integer toGrade,
        /** Example: ["A","B","C"] */
        @NotEmpty List<String> sections,
        /**
         * Optional per-grade overrides (allows different section lists per grade).
         * When provided, this is used instead of {@code sections}.
         */
        List<GradeSectionsDTO> gradeSections,
        /** Optional capacity applied to newly created sections. */
        Integer defaultCapacity
) {
    public record GradeSectionsDTO(@NotNull Integer gradeLevel, @NotEmpty List<String> sections) {}
}

