package com.myhaimi.sms.DTO.studentportal;

import com.fasterxml.jackson.annotation.JsonFormat;

import java.time.LocalDate;
import java.time.LocalTime;

/**
 * Upcoming exam hall ticket–style card for the student portal. {@code layout} is {@code COMBINED} (single title in
 * header) or {@code SPLIT} (subject code left, lines right).
 */
public record StudentExamCardDTO(
        String layout,
        String headerLeft,
        String headerTitle,
        String headerSession,
        String headerFormat,
        String subjectNameCaps,
        @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd") LocalDate examDate,
        @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "HH:mm") LocalTime startTime,
        @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "HH:mm") LocalTime endTime,
        String room) {}
