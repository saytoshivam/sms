package com.myhaimi.sms.DTO.timetable.engine;

import jakarta.validation.constraints.NotNull;

public record TimetableCellUpdateDTO(
        @NotNull Integer timetableVersionId,
        @NotNull Integer classGroupId,
        @NotNull String dayOfWeek,
        @NotNull Integer timeSlotId,
        Integer subjectId,
        Integer staffId,
        Integer roomId,
        Boolean locked
) {}

