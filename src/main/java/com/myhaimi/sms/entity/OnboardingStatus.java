package com.myhaimi.sms.entity;

/**
 * School onboarding steps.
 *
 * <p>Stored on {@link School} as {@code onboarding_status} (current step) and as a JSON set of completed steps.</p>
 */
public enum OnboardingStatus {
    BASIC_INFO,
    CLASSES,
    SUBJECTS,
    /** Map each subject to concrete class groups (sections), e.g. 6-A, 6-B. (Legacy; new flow uses {@link #ACADEMIC_STRUCTURE}.) */
    SUBJECT_CLASS_MAPPING,
    ROOMS,
    /** Map each class group to a default (homeroom) room for the school. (Legacy; can be set from Academic Structure in the new flow.) */
    CLASS_DEFAULT_ROOMS,
    ROLES,
    STAFF,
    /**
     * Unified step: for each class group, set subject + weekly frequency + teacher, and (optional) default homeroom per class
     * from rooms.
     */
    ACADEMIC_STRUCTURE,
    TIMETABLE,
    STUDENTS,
    FEES,
    NOTIFICATIONS,
    BRANDING
}

