package com.myhaimi.sms.DTO;

import java.math.BigDecimal;

/**
 * Business snapshot for school owners / leadership: fees, subscription, scale, and enrollment momentum.
 */
public record SchoolManagementOverviewDTO(
        FeeSchoolSummaryDTO fees,
        String subscriptionPlanCode,
        String subscriptionPlanName,
        String subscriptionStatus,
        long staffCount,
        long classGroupCount,
        long newStudentsLast30Days,
        long newStudentsPrior30Days,
        BigDecimal enrollmentGrowthPercent) {}
