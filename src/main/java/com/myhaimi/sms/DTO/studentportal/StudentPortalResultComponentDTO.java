package com.myhaimi.sms.DTO.studentportal;

import java.math.BigDecimal;

/**
 * Per-component breakdown within a {@link StudentPortalResultDTO}.
 */
public record StudentPortalResultComponentDTO(
        Integer id,
        String componentName,
        String calculationRule,
        BigDecimal rawScore,
        BigDecimal rawMax,
        BigDecimal weightedScore,
        BigDecimal weightagePercent,
        /** JSON blob of per-assessment drill-down (instance names, scores, dropped flags). */
        String calculationDetailsJson
) {}

