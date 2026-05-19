package com.myhaimi.sms.entity.enums;

public enum ApplicableScopeType {
    /** Applies to all students in the school. */
    SCHOOL,
    /** Applies to all students in a specific class/grade (ClassGroup by grade). */
    CLASS,
    /** Applies to all students in a specific section (ClassGroup). */
    SECTION,
    /** Applies to a specific student only. */
    STUDENT
}
