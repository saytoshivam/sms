package com.myhaimi.sms.DTO.timetable.engine;

import java.util.List;
import java.util.Map;

public record TimetableSetupDTO(
        Integer schoolId,
        List<String> workingDays,
        List<Map<String, Object>> slots,
        List<Map<String, Object>> classGroups,
        List<Map<String, Object>> subjects,
        List<Map<String, Object>> teachers,
        List<Map<String, Object>> rooms,
        List<Map<String, Object>> allocations,
        Map<String, Object> capacities
) {}

