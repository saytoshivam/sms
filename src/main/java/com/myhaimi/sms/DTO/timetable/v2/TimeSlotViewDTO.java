package com.myhaimi.sms.DTO.timetable.v2;

import java.time.LocalTime;

public record TimeSlotViewDTO(
        Integer id,
        LocalTime startTime,
        LocalTime endTime,
        Integer slotOrder,
        boolean isBreak
) {}

