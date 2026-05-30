package com.myhaimi.sms.modules.exam.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

/**
 * Payload for bulk saving (draft or submit) marks for one assessment instance.
 */
public record MarksEntryBulkSaveDTO(
        @NotEmpty @Valid List<MarksEntrySubmitDTO> rows
) {}

