package com.myhaimi.sms.modules.exam.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

public record AssessmentInstanceUpdateDTO(
        @NotBlank @Size(max = 128) String name,
        @NotNull Integer subjectId,
        @NotNull Integer classGroupId,
        LocalDate assessmentDate,
        LocalTime startTime,
        LocalTime endTime,
        Integer roomId,
        @NotNull @DecimalMin("0.01") BigDecimal maxMarks,
        @NotNull @Min(1) Integer sequence
) {}

