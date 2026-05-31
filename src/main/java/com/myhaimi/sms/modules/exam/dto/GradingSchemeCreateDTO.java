package com.myhaimi.sms.modules.exam.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;

public record GradingSchemeCreateDTO(
        @NotBlank @Size(max = 128) String name,
        /** Legacy optional field accepted for backwards compatibility. Prefer effectiveFrom/To. */
        Integer academicYearId,
        String scope,
        Integer classGroupId,
        Boolean defaultScheme,
        BigDecimal passingPercent,
        Integer effectiveFromAcademicYearId,
        Integer effectiveToAcademicYearId,
        boolean active,
        @NotEmpty @Valid List<GradingBandCreateDTO> bands
) {}
