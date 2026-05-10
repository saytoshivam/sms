package com.myhaimi.sms.DTO.student;

import lombok.Builder;
import lombok.Data;

/**
 * Aggregate counts for the student-module landing dashboard.
 * Returned by {@code GET /api/students/roster-health}.
 * No personal data — only counts.
 */
@Data
@Builder
public class StudentRosterHealthDTO {
    private long activeCount;
    private long newThisMonthCount;
    private long missingGuardianCount;
    private long noSectionCount;
    private long inactiveCount;
    private long transferredCount;
    private long alumniCount;
}

