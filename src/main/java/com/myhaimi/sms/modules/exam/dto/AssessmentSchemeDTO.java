package com.myhaimi.sms.modules.exam.dto;

import com.myhaimi.sms.modules.exam.entity.enums.AssessmentSchemeStatus;

import java.time.Instant;
import java.util.List;

public record AssessmentSchemeDTO(
        Integer id,
        Integer schoolId,
        Integer academicYearId,
        String academicYearLabel,
        String name,
        String description,
        AssessmentSchemeStatus status,
        Integer versionNo,
        Instant publishedAt,
        Instant archivedAt,
        Instant createdAt,
        Instant updatedAt,
        Integer assignedClassCount,
        Integer assignedSubjectCount,
        String assignmentLabel,
        List<AssessmentSchemeAssignmentDTO> assignments,
        List<AssessmentComponentDTO> components
) {}
