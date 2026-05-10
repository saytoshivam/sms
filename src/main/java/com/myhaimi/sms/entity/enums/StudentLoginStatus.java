package com.myhaimi.sms.entity.enums;

/** Login account status for a student portal user. */
public enum StudentLoginStatus {
    /** No login account has been created yet. */
    NOT_CREATED,
    /** Account created, invite/password shared but student has not yet logged in. */
    INVITED,
    /** Account exists and student has logged in at least once. */
    ACTIVE,
    /** Account has been disabled by an administrator. */
    DISABLED
}

