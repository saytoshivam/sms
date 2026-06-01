package com.myhaimi.sms.modules.exam.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * A preview/candidate row for the smart exam schedule generator.
 * Not persisted — returned from the generator for the admin to review and edit before saving.
 */
public record ScheduleCandidateDTO(
        Integer classGroupId,
        String classGroupLabel,
        Integer subjectId,
        String subjectName,

        /** Null when no applicable published scheme was found. */
        Integer schemeId,
        String schemeName,

        /** Null when the scheme has no component of the requested type. */
        Integer componentId,
        String componentName,
        String componentType,

        LocalDate assessmentDate,
        String defaultStartTime,
        String defaultEndTime,

        /** Null when strategy = MANUAL and admin hasn't provided a value, or component has no max marks. */
        BigDecimal maxMarks,

        /**
         * OK = candidate is valid and ready to save.
         * NO_SCHEME = no published scheme applies to this class-section/subject.
         * NO_COMPONENT = the resolved scheme has no component of the requested type.
         * MISSING_MAX_MARKS = max marks could not be determined (component has no max marks and strategy is USE_COMPONENT).
         */
        String validationStatus,
        String validationMessage,
        Integer sequence
) {
    public boolean isValid() {
        return "OK".equals(validationStatus);
    }
}

