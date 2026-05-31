package com.myhaimi.sms.modules.exam.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record AssessmentSchemeCreateDTO(
        @NotNull Integer academicYearId,
        @NotBlank @Size(max = 128) String name,
        @Size(max = 2000) String description,
        List<@Valid AssessmentSchemeAssignmentCreateDTO> assignments,
        List<@Valid AssessmentComponentCreateDTO> components
) {}
