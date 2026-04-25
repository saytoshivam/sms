package com.myhaimi.sms.DTO.performance;

public record StudentPerformanceSummary(
        int studentId,
        String admissionNo,
        String fullName,
        String classGroupName
) {}
