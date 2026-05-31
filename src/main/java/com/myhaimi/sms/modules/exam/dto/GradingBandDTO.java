package com.myhaimi.sms.modules.exam.dto;

import java.math.BigDecimal;

public record GradingBandDTO(
        Integer id,
        String grade,
        BigDecimal minPercent,
        BigDecimal maxPercent,
        String label,
        String resultType,
        BigDecimal gradePoint,
        String remarks,
        Integer sequence
) {}
