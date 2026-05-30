package com.myhaimi.sms.modules.exam.entity.enums;

public enum ResultStatus {
    /** Result has been calculated but not yet locked. */
    GENERATED,
    /** Result is locked and frozen; no recalculation allowed without explicit regenerate. */
    LOCKED,
    /** Result is visible to students/parents. */
    PUBLISHED
}

