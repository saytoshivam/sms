package com.myhaimi.sms.modules.exam.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record GradingBandCreateDTO(
        @NotBlank @Size(max = 16) String grade,
        @NotNull @DecimalMin("0.00") @DecimalMax("100.00") BigDecimal minPercent,
        @NotNull @DecimalMin("0.00") @DecimalMax("100.00") BigDecimal maxPercent,
        BigDecimal gradePoint,
        @Size(max = 128) String remarks,
        @NotNull @Min(1) Integer sequence
) {}
