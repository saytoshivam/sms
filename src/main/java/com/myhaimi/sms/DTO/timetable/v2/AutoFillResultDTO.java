package com.myhaimi.sms.DTO.timetable.v2;

import java.util.List;

public record AutoFillResultDTO(
        int placedCount,
        int skippedFilledCount,
        int skippedConflictCount,
        int skippedNoAllocationCount,
        List<String> warnings
) {}

