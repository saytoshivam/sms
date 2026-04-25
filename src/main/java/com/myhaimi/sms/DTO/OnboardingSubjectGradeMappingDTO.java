package com.myhaimi.sms.DTO;

import jakarta.validation.constraints.NotNull;

import java.util.List;

/**
 * One grade (class) mapping for a subject.
 *
 * <p>If {@code appliesToAllSections} is true, section overrides are ignored for that grade.</p>
 */
public record OnboardingSubjectGradeMappingDTO(
        @NotNull Integer gradeLevel,
        @NotNull Boolean appliesToAllSections,
        /** When appliesToAllSections is false: list of class_group ids (sections) the subject applies to. */
        List<Integer> classGroupIds
) {}

