package com.myhaimi.sms.DTO.attendance;

public record TeacherDailySectionRowDTO(
        int classGroupId,
        String displayName,
        /** Needs submit (no locked attendance yet today). */
        boolean pendingAttendance,
        Integer sessionId,
        boolean locked) {}
