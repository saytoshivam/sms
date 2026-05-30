package com.myhaimi.sms.modules.exam.dto;

import com.myhaimi.sms.modules.exam.entity.enums.MarkStatus;

import java.math.BigDecimal;
import java.time.Instant;

public record StudentAssessmentMarkDTO(
        Integer id,
        Integer assessmentInstanceId,
        String assessmentName,
        Integer studentId,
        String studentAdmissionNo,
        String studentFullName,
        BigDecimal marksObtained,
        boolean absent,
        String absentReason,
        String remarks,
        MarkStatus status,
        String enteredBy,
        Instant submittedAt,
        Instant lockedAt,
        Instant createdAt,
        Instant updatedAt
) {}

