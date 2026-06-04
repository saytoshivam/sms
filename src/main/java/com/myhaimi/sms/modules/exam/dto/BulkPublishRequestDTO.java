package com.myhaimi.sms.modules.exam.dto;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;

/**
 * Request body for bulk-publishing multiple DRAFT assessment instances.
 * Each instance must have a date, start/end time, and max marks > 0.
 */
public record BulkPublishRequestDTO(
        @NotEmpty List<Integer> assessmentIds
) {}

