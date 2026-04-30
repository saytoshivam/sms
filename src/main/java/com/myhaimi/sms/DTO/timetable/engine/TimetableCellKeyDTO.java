package com.myhaimi.sms.DTO.timetable.engine;

import jakarta.validation.constraints.NotNull;

public record TimetableCellKeyDTO(
        @NotNull Integer classGroupId,
        @NotNull String dayOfWeek,
        @NotNull Integer timeSlotId
) {}

