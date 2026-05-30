package com.myhaimi.sms.modules.exam.entity.enums;

public enum MarkStatus {
    /** Mark record saved but not yet confirmed by teacher. */
    DRAFT,
    /** Teacher has confirmed and submitted all marks for this assessment. */
    SUBMITTED,
    /** Marks locked by admin/principal; no further edits allowed. */
    LOCKED
}

