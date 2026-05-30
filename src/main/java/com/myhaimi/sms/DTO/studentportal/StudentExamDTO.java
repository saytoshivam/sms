package com.myhaimi.sms.DTO.studentportal;

import java.math.BigDecimal;

/**
 * Student-facing view of an assessment instance (exam/test/assignment).
 */
public record StudentExamDTO(
        Integer id,
        String assessmentName,
        String componentName,
        String componentType,
        String schemeName,
        String subjectName,
        String subjectCode,
        String classGroupLabel,
        String academicYearLabel,
        /** ISO date string yyyy-MM-dd, or null if not scheduled. */
        String assessmentDate,
        /** HH:mm, or null. */
        String startTime,
        /** HH:mm, or null. */
        String endTime,
        /** Composed as "Building RoomNo", or null if no room assigned. */
        String roomLabel,
        BigDecimal maxMarks,
        /** AssessmentInstanceStatus string (SCHEDULED, MARKS_ENTRY_OPEN, LOCKED, PUBLISHED …). */
        String status
) {}

