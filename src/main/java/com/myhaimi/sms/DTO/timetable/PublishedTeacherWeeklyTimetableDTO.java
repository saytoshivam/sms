package com.myhaimi.sms.DTO.timetable;

import java.time.Instant;
import java.util.List;

public record PublishedTeacherWeeklyTimetableDTO(
        Integer versionNumber,
        Instant publishedAt,
        List<String> dayOrder,
        List<PublishedWeeklyPeriodDTO> periods,
        List<PublishedTeacherGridCellDTO> cells,
        int weeklyTeachingPeriods,
        int freePeriodsTotal,
        List<PublishedTeacherGridCellDTO> todayCells
) {}
