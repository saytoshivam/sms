package com.myhaimi.sms.modules.exam.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record GradingSchemeDTO(
        Integer id,
        Integer schoolId,
        /** Legacy field retained for older clients; new UI uses effectiveFrom/To. */
        Integer academicYearId,
        Integer effectiveFromAcademicYearId,
        Integer effectiveToAcademicYearId,
        String scope,
        Integer classGroupId,
        String classGroupLabel,
        String name,
        boolean defaultScheme,
        BigDecimal passingPercent,
        boolean active,
        Instant createdAt,
        Instant updatedAt,
        List<GradingBandDTO> bands
) {}
