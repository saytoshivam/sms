package com.myhaimi.sms.modules.exam.dto;

import com.myhaimi.sms.modules.exam.entity.enums.ExamApplicableScopeType;

import java.time.Instant;

public record AssessmentSchemeAssignmentDTO(
        Integer id,
        Integer schoolId,
        Integer schemeId,
        Integer academicYearId,
        ExamApplicableScopeType scopeType,
        Integer classGroupId,
        String classGroupLabel,
        Integer gradeLevel,
        Integer subjectId,
        String subjectName,
        String subjectCode,
        boolean active,
        Instant createdAt,
        Instant updatedAt
) {}

