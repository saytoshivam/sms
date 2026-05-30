package com.myhaimi.sms.modules.exam.dto;

import com.myhaimi.sms.modules.exam.entity.enums.ExamApplicableScopeType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record AssessmentSchemeCreateDTO(
        @NotNull Integer academicYearId,
        @NotBlank @Size(max = 128) String name,
        @Size(max = 2000) String description,
        @NotNull ExamApplicableScopeType applicableScopeType,
        Integer applicableScopeId
) {}
