package com.myhaimi.sms.DTO.timetable.v2;

import jakarta.validation.constraints.NotNull;

import java.time.LocalTime;

public record TimeSlotCreateDTO(
        @NotNull LocalTime startTime,
        @NotNull LocalTime endTime,
        @NotNull Integer slotOrder,
        Boolean isBreak
) {}

