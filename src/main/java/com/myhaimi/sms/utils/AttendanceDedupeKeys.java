package com.myhaimi.sms.utils;

import java.time.LocalDate;

public final class AttendanceDedupeKeys {

    private AttendanceDedupeKeys() {}

    public static String daily(int schoolId, int classGroupId, LocalDate date) {
        return "d-" + schoolId + "-" + classGroupId + "-" + date;
    }

    public static String lecture(int lectureId) {
        return "l-" + lectureId;
    }
}
