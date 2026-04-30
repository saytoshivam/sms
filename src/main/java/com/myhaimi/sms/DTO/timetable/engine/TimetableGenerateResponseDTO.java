package com.myhaimi.sms.DTO.timetable.engine;

import com.myhaimi.sms.DTO.timetable.v2.TimetableEntryViewDTO;
import com.myhaimi.sms.DTO.timetable.v2.TimetableVersionViewDTO;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public record TimetableGenerateResponseDTO(
        boolean success,
        TimetableVersionViewDTO version,
        List<TimetableEntryViewDTO> timetable,
        List<TimetableConflictDTO> hardConflicts,
        List<TimetableConflictDTO> softConflicts,
        Instant generatedAt,
        Map<String, Object> stats
) {}

