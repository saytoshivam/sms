package com.myhaimi.sms.DTO.studentportal;

import java.math.BigDecimal;
import java.util.List;

/**
 * Student-facing view of a published result for one subject under one assessment scheme.
 */
public record StudentPortalResultDTO(
        Integer id,
        String schemeName,
        String academicYearLabel,
        String subjectName,
        String subjectCode,
        String classGroupLabel,
        BigDecimal totalWeightedScore,
        BigDecimal percentage,
        String grade,
        /** ResultStatus — only PUBLISHED results are exposed via the student portal. */
        String status,
        String generatedAt,
        String publishedAt,
        List<StudentPortalResultComponentDTO> components
) {}

