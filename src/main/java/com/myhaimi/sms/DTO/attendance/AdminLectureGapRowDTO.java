package com.myhaimi.sms.DTO.attendance;

public record AdminLectureGapRowDTO(
        String teacherName,
        int classGroupId,
        String classGroupDisplayName,
        int lectureRowId,
        String subject,
        String startTime,
        String endTime,
        /** Published period ended (incl. grace) and no locked attendance linked to materialized lecture. */
        boolean periodEndedWithoutLockedAttendance) {}
