package com.myhaimi.sms.modules.platform.api.dto;

public record PlatformMetricsResponse(
        long totalSchools, long activeSchools, long totalStudents, long activeSubscriptions) {}
