package com.myhaimi.sms.modules.exam.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record GradingSchemeDTO(
        Integer id,
        Integer schoolId,
        Integer academicYearId,
        String name,
        boolean active,
        Instant createdAt,
        Instant updatedAt,
        List<GradingBandDTO> bands
) {}
