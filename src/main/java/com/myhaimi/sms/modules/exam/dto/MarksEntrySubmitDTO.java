package com.myhaimi.sms.modules.exam.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

/**
 * A single row of marks data submitted by the teacher.
 */
public record MarksEntrySubmitDTO(
        @NotNull Integer studentId,
        /** Null when absent or not yet entered. */
        @DecimalMin(value = "0.0", inclusive = true) BigDecimal marksObtained,
        boolean absent,
        String absentReason,
        String remarks
) {}

