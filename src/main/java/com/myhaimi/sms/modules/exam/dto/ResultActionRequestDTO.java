package com.myhaimi.sms.modules.exam.dto;

import jakarta.validation.constraints.NotNull;

public record ResultActionRequestDTO(
        @NotNull Integer classGroupId,
        @NotNull Integer schemeId,
        @NotNull Integer subjectId
) {}

