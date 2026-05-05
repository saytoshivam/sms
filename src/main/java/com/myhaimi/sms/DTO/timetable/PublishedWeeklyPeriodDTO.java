package com.myhaimi.sms.DTO.timetable;

import com.fasterxml.jackson.annotation.JsonFormat;

import java.time.LocalTime;

public record PublishedWeeklyPeriodDTO(
        Integer timeSlotId,
        int slotOrder,
        @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "HH:mm") LocalTime startTime,
        @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "HH:mm") LocalTime endTime,
        boolean breakSlot
) {}
