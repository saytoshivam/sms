package com.myhaimi.sms.entity;

/**
 * How the school records attendance: once per day for the whole class (class teacher), or per scheduled lecture
 * (subject teacher / lecturer).
 */
public enum AttendanceMode {
    /** One session per class per calendar day; class teacher marks everyone for the whole day. */
    DAILY,
    /** One session per lecture; the teacher taking that lecture marks attendance for that period. */
    LECTURE_WISE
}
