package com.myhaimi.sms.DTO.staff;

import lombok.Builder;
import lombok.Data;

/**
 * Aggregated counts shown in the summary card row of the Staff Readiness dashboard.
 */
@Data
@Builder
public class StaffReadinessSummaryDTO {

    /** Total non-deleted staff in the school. */
    private int totalStaff;

    /** Staff with type=TEACHING and status=ACTIVE. */
    private int activeTeachers;

    /** Teaching staff who have ≥1 teachable subject AND the TEACHER role. */
    private int timetableEligibleTeachers;

    /** Teaching staff with no teachable subjects assigned. */
    private int teachersMissingSubjects;

    /** Any staff without a login account. */
    private int staffMissingLogin;

    /** Staff with at least one document in PENDING_COLLECTION status. */
    private int staffDocumentsPending;

    /** Teachers whose assigned weekly load exceeds their maxWeeklyLectureLoad. */
    private int overloadedTeachers;
}
