package com.myhaimi.sms.modules.exam.dto;

import com.myhaimi.sms.modules.exam.entity.enums.CalculationRule;
import com.myhaimi.sms.modules.exam.entity.enums.ComponentType;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record AssessmentComponentCreateDTO(
        @NotBlank @Size(max = 128) String name,
        @NotNull ComponentType componentType,
        @NotNull @DecimalMin("0.01") BigDecimal weightagePercent,
        BigDecimal maxMarks,
        @NotNull CalculationRule calculationRule,
        Integer totalAssessments,
        Integer bestOfCount,
        @NotNull @Min(1) Integer sequence,
        boolean mandatory
) {}
