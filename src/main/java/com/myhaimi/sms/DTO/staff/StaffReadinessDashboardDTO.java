package com.myhaimi.sms.DTO.staff;

import lombok.Builder;
import lombok.Data;

import java.util.List;

/**
 * Top-level response for GET /api/staff/readiness.
 * Contains summary KPIs and six readiness queues, each listing staff members
 * with a specific incomplete onboarding step.
 */
@Data
@Builder
public class StaffReadinessDashboardDTO {

    /** Aggregate summary counts for the card row. */
    private StaffReadinessSummaryDTO summary;

    /** Teaching staff with no teachable subjects assigned. */
    private List<StaffReadinessIssueDTO> missingSubjects;

    /** Any staff without a login (User) account. */
    private List<StaffReadinessIssueDTO> missingLogin;

    /** Staff with at least one document still in PENDING_COLLECTION status. */
    private List<StaffReadinessIssueDTO> missingDocuments;

    /** Staff whose joiningDate has not been recorded. */
    private List<StaffReadinessIssueDTO> missingJoiningDate;

    /** Teachers whose assigned weekly load exceeds their weekly load cap. */
    private List<StaffReadinessIssueDTO> overCapacity;

    /** Teaching staff who cannot be placed in the timetable (missing role or subjects). */
    private List<StaffReadinessIssueDTO> notTimetableEligible;
}
