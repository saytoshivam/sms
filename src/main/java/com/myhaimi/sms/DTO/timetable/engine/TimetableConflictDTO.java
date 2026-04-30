package com.myhaimi.sms.DTO.timetable.engine;

public record TimetableConflictDTO(
        String severity, // HARD | SOFT
        String kind,     // TEACHER_DOUBLE_BOOKED | ROOM_CLASH | MISSING_FREQUENCY | TEACHER_NOT_TEACHABLE | ROOM_TYPE_MISMATCH | OVERLOAD | ...
        Integer classGroupId,
        String classGroupCode,
        String dayOfWeek,
        Integer timeSlotId,
        String title,
        String detail
) {}

