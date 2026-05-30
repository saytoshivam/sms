package com.myhaimi.sms.modules.exam.dto;

import com.myhaimi.sms.modules.exam.entity.enums.MarkStatus;

import java.math.BigDecimal;

/**
 * One row in the marks-entry sheet – one per student.
 */
public record MarksEntryRowDTO(
        Integer studentId,
        String admissionNo,
        String fullName,
        /** Null when no mark record exists yet (new/unsaved). */
        Integer markId,
        BigDecimal marksObtained,
        boolean absent,
        String absentReason,
        String remarks,
        MarkStatus status
) {}

