package com.myhaimi.sms.modules.exam.dto;

import com.myhaimi.sms.modules.exam.entity.enums.ExamApplicableScopeType;
import jakarta.validation.constraints.NotNull;

public record AssessmentSchemeAssignmentCreateDTO(
        @NotNull ExamApplicableScopeType scopeType,
        Integer classGroupId,
        Integer subjectId
) {}

