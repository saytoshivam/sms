package com.myhaimi.sms.DTO.timetable.v2;

public record TimetableEntryViewDTO(
        Integer id,
        Integer classGroupId,
        String dayOfWeek,
        Integer timeSlotId,
        Integer subjectId,
        String subjectCode,
        String subjectName,
        Integer staffId,
        String staffName,
        Integer roomId,
        String roomLabel
) {}

