package com.myhaimi.sms.modules.exam.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record GradingSchemeCreateDTO(
        @NotBlank @Size(max = 128) String name,
        Integer academicYearId,
        boolean active,
        @NotEmpty @Valid List<GradingBandCreateDTO> bands
) {}
