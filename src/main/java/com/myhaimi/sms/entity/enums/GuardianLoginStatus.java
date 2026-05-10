package com.myhaimi.sms.entity.enums;

/** Login account status for a parent/guardian. */
public enum GuardianLoginStatus {
    /** No login account has been created yet. */
    NOT_CREATED,
    /** Account created but guardian has not yet logged in (invite sent). */
    INVITED,
    /** Account exists and guardian has logged in at least once. */
    ACTIVE
}

