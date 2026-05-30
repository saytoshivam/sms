package com.myhaimi.sms.DTO.performance;

import java.util.List;

public record StudentPerformanceDashboardDTO(
        StudentPerformanceSummary student,
        List<MonthlyAttendancePoint> attendanceTrend,
        double overallAttendancePercent
) {}