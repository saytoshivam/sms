package com.myhaimi.sms.modules.exam.entity.enums;

public enum ExamApplicableScopeType {
    /** Applies to all classes / subjects in the school. */
    SCHOOL,
    /** Applies to one class/grade target represented by one or more class groups. */
    CLASS,
    /** Applies to a specific class section. */
    SECTION,
    /** Applies to a specific subject across the school. */
    SUBJECT,
    /** Applies to a subject for a class/grade target. */
    CLASS_SUBJECT,
    /** Applies to a subject for one specific section. */
    SECTION_SUBJECT
}
