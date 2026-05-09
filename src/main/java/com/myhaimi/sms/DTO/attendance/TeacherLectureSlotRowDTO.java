package com.myhaimi.sms.DTO.attendance;

public record TeacherLectureSlotRowDTO(
        int classGroupId,
        String classGroupDisplayName,
        /** Same encoding as lecture-day picker / timetable. */
        int lectureRowId,
        String subject,
        String startTime,
        String endTime,
        boolean markingWindowOpenNow,
        boolean canOperateThisSlot,
        Integer sessionId,
        boolean locked) {}
