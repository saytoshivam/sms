package com.myhaimi.sms.DTO.performance;

import com.fasterxml.jackson.annotation.JsonFormat;

import java.time.YearMonth;

/** {@code period} is the calendar month aggregated for attendance (ISO-8601 month, e.g. 2026-04). */
public record MonthlyAttendancePoint(
        @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM") YearMonth period,
        double presentPercent,
        int presentDays,
        int totalDays) {}
