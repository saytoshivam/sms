package com.myhaimi.sms.modules.exam.dto;

import java.util.List;

/**
 * Response from the "Generate from Scheme" endpoint.
 * Contains the generated draft instances plus a summary of any issues encountered.
 */
public record ExamScheduleGenerateResponseDTO(
        String scheduleGroupId,
        int generatedCount,
        int skippedCount,
        int missingSchemeCount,
        int notSchedulableCount,
        List<String> warnings,
        List<AssessmentInstanceDTO> instances
) {}

