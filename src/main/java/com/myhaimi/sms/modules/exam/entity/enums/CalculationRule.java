package com.myhaimi.sms.modules.exam.entity.enums;

public enum CalculationRule {
    /** A single test/exam score. */
    SINGLE_ASSESSMENT,
    /** Sum of all assessment scores. */
    SUM,
    /** Average of all assessment scores. */
    AVERAGE,
    /** Best N scores out of M total assessments. */
    BEST_N_OF_M,
    /** Take the highest single score. */
    HIGHEST,
    /** Score entered manually by teacher (not computed). */
    MANUAL,
    /** Derived from student attendance percentage. */
    ATTENDANCE_PERCENTAGE
}
