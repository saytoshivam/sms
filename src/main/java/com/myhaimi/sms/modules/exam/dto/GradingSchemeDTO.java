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
        List<Integer> classGroupIds,
        List<String> classGroupLabels,
        String name,
        boolean defaultScheme,
        BigDecimal passingPercent,
        String status,
        boolean active,
        boolean conflict,
        String conflictMessage,
        Instant createdAt,
        Instant updatedAt,
        List<GradingBandDTO> bands
) {}
