package com.myhaimi.sms.modules.exam.dto;

import java.math.BigDecimal;

public record StudentResultComponentDTO(
        Integer id,
        Integer assessmentComponentId,
        String componentName,
        String calculationRule,
        BigDecimal rawScore,
        BigDecimal rawMax,
        BigDecimal weightedScore,
        BigDecimal weightagePercent,
        String calculationDetailsJson
) {}

