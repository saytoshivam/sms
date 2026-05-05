package com.myhaimi.sms.DTO.timetable;

public record PublishedTeacherGridCellDTO(
        String dayOfWeek,
        int timeSlotId,
        String subject,
        /** Class section display (class group label). */
        String classGroupDisplayName,
        String room,
        boolean breakSlot,
        /** True when this period is teaching time but this teacher has no class. */
        boolean free
) {}
