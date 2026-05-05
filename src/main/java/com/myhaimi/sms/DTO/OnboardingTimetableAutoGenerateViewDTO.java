package com.myhaimi.sms.DTO;

import java.util.List;

public record OnboardingTimetableAutoGenerateViewDTO(
        int timetableVersionId,
        String status,
        int version,
        List<OnboardingTimetableClassAutoFillItemDTO> perClass,
        /** Populated when weekly teacher capacity looks insufficient vs mapped subject frequencies. */
        List<String> teacherDemandWarnings,
        /** Sum of placed weekly sessions across classes (matches per-class {@code placedCount}). */
        int placed,
        /** Total weekly periods requested via subject allocations (sum of weeklyFrequency). */
        int required) {}
