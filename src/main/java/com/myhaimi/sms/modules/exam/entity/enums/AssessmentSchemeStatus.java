package com.myhaimi.sms.modules.exam.entity.enums;

public enum AssessmentSchemeStatus {
    /** Scheme is being configured; all fields are editable. */
    DRAFT,
    /** Scheme is locked for use; no edits allowed. Can be cloned to create a new version. */
    PUBLISHED,
    /** Scheme is retired; read-only, no longer assignable. */
    ARCHIVED
}
