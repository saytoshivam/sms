package com.myhaimi.sms.DTO.performance;

import com.fasterxml.jackson.annotation.JsonFormat;

import java.time.LocalDate;

public record MarkTrendPoint(
        @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd") LocalDate assessedOn,
        double scorePercent) {}
