package com.myhaimi.sms.modules.exam.dto;

import com.myhaimi.sms.modules.exam.entity.enums.AssessmentInstanceStatus;
import com.myhaimi.sms.modules.exam.entity.enums.MarkStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Full marks-entry sheet for one assessment instance, returned to the UI.
 * Contains assessment metadata + one row per enrolled student.
 */
public record MarksEntrySheetDTO(
        Integer assessmentInstanceId,
        String assessmentName,
        String componentName,
        String schemeName,
        String classGroupLabel,
        String subjectName,
        LocalDate assessmentDate,
        BigDecimal maxMarks,
        AssessmentInstanceStatus assessmentStatus,
        List<MarksEntryRowDTO> rows
) {}

