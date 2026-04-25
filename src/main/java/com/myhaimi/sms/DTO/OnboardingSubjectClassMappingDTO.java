package com.myhaimi.sms.DTO;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;

/**
 * Maps a subject (by school-local code) to grades, with optional section overrides.
 */
public record OnboardingSubjectClassMappingDTO(
        @NotBlank String subjectCode,
        @NotNull List<OnboardingSubjectGradeMappingDTO> classMappings
) {}

