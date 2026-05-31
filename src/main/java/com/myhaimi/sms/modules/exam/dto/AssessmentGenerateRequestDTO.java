package com.myhaimi.sms.modules.exam.dto;

import jakarta.validation.Valid;

import java.time.LocalDate;
import java.util.List;

public record AssessmentGenerateRequestDTO(
        /** Optional. If omitted, class groups are derived from active scheme assignments. */
        List<Integer> classGroupIds,
        /** Optional. If omitted, subjects are derived from subject assignments or all active subjects. */
        List<Integer> subjectIds,
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
