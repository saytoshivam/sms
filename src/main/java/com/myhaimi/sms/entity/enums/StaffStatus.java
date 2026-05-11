package com.myhaimi.sms.entity.enums;

/** HR lifecycle status of a staff record. */
public enum StaffStatus {
    /** Profile created; not yet fully onboarded / activated. */
    DRAFT,
    /** Currently employed and active. */
    ACTIVE,
    /** Temporarily inactive (e.g. long leave without pay). */
    INACTIVE,
    /** On approved leave (maternity, medical, etc.). */
    ON_LEAVE,
    /** Resigned, retired or contract ended. */
    EXITED,
    /** Suspended pending enquiry. */
    SUSPENDED
}
