package com.myhaimi.sms.DTO.timetable;

public record PublishedStudentGridCellDTO(
        String dayOfWeek,
        int timeSlotId,
        String subject,
        String teacherName,
        String room,
        boolean breakSlot,
        boolean free
) {}
