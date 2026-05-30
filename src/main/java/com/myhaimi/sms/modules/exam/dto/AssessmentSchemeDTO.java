package com.myhaimi.sms.modules.exam.dto;

import com.myhaimi.sms.modules.exam.entity.enums.AssessmentSchemeStatus;
import com.myhaimi.sms.modules.exam.entity.enums.ExamApplicableScopeType;

import java.time.Instant;
import java.util.List;

public record AssessmentSchemeDTO(
        Integer id,
        Integer schoolId,
        Integer academicYearId,
        String academicYearLabel,
        String name,
        String description,
        ExamApplicableScopeType applicableScopeType,
        Integer applicableScopeId,
        AssessmentSchemeStatus status,
        Integer versionNo,
        Instant publishedAt,
        Instant archivedAt,
        Instant createdAt,
        Instant updatedAt,
        List<AssessmentComponentDTO> components
) {}
