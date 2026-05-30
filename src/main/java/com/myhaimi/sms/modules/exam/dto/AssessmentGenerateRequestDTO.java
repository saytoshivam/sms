package com.myhaimi.sms.modules.exam.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

import java.time.LocalDate;
import java.util.List;

public record AssessmentGenerateRequestDTO(
        @NotEmpty List<Integer> classGroupIds,
        @NotEmpty List<Integer> subjectIds,
        @Valid List<AssessmentDateOverrideDTO> assessmentDates
) {
    public record AssessmentDateOverrideDTO(
            Integer componentId,
            Integer classGroupId,
            Integer subjectId,
            Integer sequence,
            LocalDate assessmentDate
    ) {}
}

