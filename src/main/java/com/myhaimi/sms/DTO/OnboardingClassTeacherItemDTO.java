package com.myhaimi.sms.DTO;

/** Per-section class teacher when saving onboarding academic structure. */
public record OnboardingClassTeacherItemDTO(
        int classGroupId,
        Integer staffId,
        /** When non-null, persisted as {@link com.myhaimi.sms.entity.ClassGroup#classTeacherLocked}. */
        Boolean classTeacherLocked,
        /** Lowercase {@code auto} or {@code manual}; null means leave existing source when staff is set. */
        String classTeacherSource) {}
