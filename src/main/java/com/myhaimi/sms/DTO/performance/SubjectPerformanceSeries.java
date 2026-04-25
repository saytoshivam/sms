package com.myhaimi.sms.DTO.performance;

import java.util.List;

public record SubjectPerformanceSeries(
        String subjectCode,
        String subjectName,
        double averagePercent,
        List<MarkTrendPoint> trend
) {}
