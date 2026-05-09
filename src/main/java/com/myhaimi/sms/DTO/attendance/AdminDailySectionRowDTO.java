package com.myhaimi.sms.DTO.attendance;

import java.time.Instant;

public record AdminDailySectionRowDTO(
        int classGroupId,
        String displayName,
        String classTeacherName,
        boolean submittedLocked,
        Integer sessionId,
        /** Cutoff configured and elapsed but section still not locked. */
        boolean cutoffMissedPending,
        Integer gradeLevel,
        String sectionLabel,
        Instant lockedAt,
        String classTeacherEmail) {}
