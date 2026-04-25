package com.myhaimi.sms.DTO;

/**
 * Onboarding step 6: meta for each (classGroupId, subjectId) teacher slot — how it was set and
 * whether auto-rebalance may change it.
 */
public record OnboardingAcademicSlotMetaDTO(
        int classGroupId,
        int subjectId,
        /** "auto" | "manual" | "rebalanced" */
        String source,
        boolean locked) {}
