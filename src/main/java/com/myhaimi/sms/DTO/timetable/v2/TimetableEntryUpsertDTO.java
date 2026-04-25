package com.myhaimi.sms.DTO.timetable.v2;

import jakarta.validation.constraints.NotNull;

public record TimetableEntryUpsertDTO(
        @NotNull Integer timetableVersionId,
        @NotNull Integer classGroupId,
        @NotNull String dayOfWeek,
        @NotNull Integer timeSlotId,
        @NotNull Integer subjectId,
        @NotNull Integer staffId,
        Integer roomId
) {}

