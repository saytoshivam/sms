package com.myhaimi.sms.modules.exam.dto;

import com.myhaimi.sms.modules.exam.entity.enums.ResultStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record StudentResultDTO(
        Integer id,
        Integer schoolId,
        Integer academicYearId,
        String academicYearLabel,
        Integer studentId,
        String studentName,
        String admissionNo,
        Integer classGroupId,
        String classGroupName,
        Integer schemeId,
        String schemeName,
        Integer subjectId,
        String subjectName,
        BigDecimal totalWeightedScore,
        BigDecimal percentage,
        String grade,
        ResultStatus status,
        Instant generatedAt,
        Instant publishedAt,
        Instant createdAt,
        Instant updatedAt,
        List<StudentResultComponentDTO> components
) {}

