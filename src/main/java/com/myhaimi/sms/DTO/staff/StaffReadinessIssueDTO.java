package com.myhaimi.sms.DTO.staff;

import lombok.Builder;
import lombok.Data;

import java.util.List;

/**
 * A single entry in a readiness queue — describes one staff member's outstanding issue.
 */
@Data
@Builder
public class StaffReadinessIssueDTO {

    private Integer staffId;

    /** Display name of the staff member. */
    private String staffName;

    /** Employee number (may be auto-generated). */
    private String employeeNo;

    /** Short human-readable description of the issue (e.g. "No teachable subjects assigned"). */
    private String issue;

    /** Operational impact if the issue is not resolved. */
    private String impact;

    /**
     * Action keys that the UI can render as buttons.
     * Possible values: OPEN_PROFILE, ASSIGN_SUBJECTS, CREATE_LOGIN, SET_LOAD, MARK_DOCUMENTS_COLLECTED.
     */
    private List<String> actions;
}
