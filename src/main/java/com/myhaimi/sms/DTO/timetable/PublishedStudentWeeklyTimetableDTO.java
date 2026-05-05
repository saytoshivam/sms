package com.myhaimi.sms.DTO.timetable;

import java.time.Instant;
import java.util.List;

public record PublishedStudentWeeklyTimetableDTO(
        Integer versionNumber,
        Instant publishedAt,
        List<String> dayOrder,
        List<PublishedWeeklyPeriodDTO> periods,
        List<PublishedStudentGridCellDTO> cells,
        List<PublishedStudentGridCellDTO> todayCells
) {}
