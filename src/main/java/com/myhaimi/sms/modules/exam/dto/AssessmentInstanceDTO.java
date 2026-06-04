package com.myhaimi.sms.modules.exam.dto;

import com.myhaimi.sms.modules.exam.entity.enums.AssessmentInstanceStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;

public record AssessmentInstanceDTO(
        Integer id,
        Integer schoolId,
        Integer academicYearId,
        String academicYearLabel,
        Integer schemeId,
        String schemeName,
        Integer componentId,
        String componentName,
        String componentType,
        String name,
        Integer subjectId,
        String subjectName,
        Integer classGroupId,
        String classGroupLabel,
        LocalDate assessmentDate,
        LocalTime startTime,
        LocalTime endTime,
        Integer roomId,
        String roomLabel,
        BigDecimal maxMarks,
        AssessmentInstanceStatus status,
        Integer sequence,
        String scheduleGroupId,
        String instructions,
        /** Staff ID of the assigned teacher (from published timetable, DELEGATED/HYBRID only). */
        Integer assignedTeacherStaffId,
        Instant createdAt,
        Instant updatedAt
) {}

