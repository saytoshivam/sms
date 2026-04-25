package com.myhaimi.sms.DTO.studentportal;

import com.fasterxml.jackson.annotation.JsonFormat;

import java.math.BigDecimal;
import java.time.LocalDate;

public record StudentMarkRowDTO(
        String subjectCode,
        String subjectName,
        String assessmentKey,
        String assessmentTitle,
        BigDecimal maxScore,
        BigDecimal scoreObtained,
        double scorePercent,
        @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd") LocalDate assessedOn,
        String termName) {}
