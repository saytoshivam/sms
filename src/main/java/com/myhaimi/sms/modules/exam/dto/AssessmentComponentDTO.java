package com.myhaimi.sms.modules.exam.dto;

import com.myhaimi.sms.modules.exam.entity.enums.CalculationRule;
import com.myhaimi.sms.modules.exam.entity.enums.ComponentType;

import java.math.BigDecimal;
import java.time.Instant;

public record AssessmentComponentDTO(
        Integer id,
        Integer schemeId,
        String name,
        ComponentType componentType,
        BigDecimal weightagePercent,
        BigDecimal maxMarks,
        CalculationRule calculationRule,
        Integer totalAssessments,
        Integer bestOfCount,
        Integer sequence,
        boolean mandatory,
        Instant createdAt,
        Instant updatedAt
) {}
