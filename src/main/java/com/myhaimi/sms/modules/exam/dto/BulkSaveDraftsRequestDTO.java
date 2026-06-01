package com.myhaimi.sms.modules.exam.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

/**
 * Request body for bulk-saving schedule candidates as DRAFT assessment instances.
 */
public record BulkSaveDraftsRequestDTO(
        @Valid @NotNull List<BulkSaveDraftItemDTO> candidates
) {
    public record BulkSaveDraftItemDTO(
            @NotNull Integer classGroupId,
            @NotNull Integer subjectId,
            @NotNull Integer schemeId,
            @NotNull Integer componentId,
            @NotNull String name,
            LocalDate assessmentDate,
            LocalTime startTime,
            LocalTime endTime,
            Integer roomId,
            /** May be null or 0 for drafts. Must be > 0 before publishing. */
            BigDecimal maxMarks,
            Integer sequence
    ) {}
}


