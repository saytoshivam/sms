package com.myhaimi.sms.DTO.timetable;

import com.fasterxml.jackson.annotation.JsonFormat;

import java.time.DayOfWeek;
import java.time.LocalTime;

public record TimetableSlotViewDTO(
        int id,
        String classGroupDisplayName,
        Integer staffId,
        String staffName,
        String teacherDisplayName,
        String subject,
        DayOfWeek dayOfWeek,
        @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "HH:mm") LocalTime startTime,
        @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "HH:mm") LocalTime endTime,
        String room,
        boolean active) {}
