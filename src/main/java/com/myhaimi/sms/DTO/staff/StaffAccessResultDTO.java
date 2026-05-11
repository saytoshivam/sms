package com.myhaimi.sms.DTO.staff;

import lombok.Data;

import java.time.Instant;
import java.util.List;

/**
 * Response returned by all staff access lifecycle actions.
 * tempPassword is non-null only after create-login and reset-password.
 */
@Data
public class StaffAccessResultDTO {

    /** NOT_CREATED / ACTIVE / DISABLED */
    private String  loginStatus;

    private Integer userId;
    private String  username;
    private String  email;
    private List<String> roles;

    /**
     * One-time temp password.
     * Non-null ONLY after create-login or reset-password — never stored or re-sent.
     */
    private String  tempPassword;

    private Instant lastInviteSentAt;

    /** Human-readable summary of what the action did or why it was skipped. */
    private String  message;

    /**
     * Integrity warning: shown when a TEACHER role user has no linkedStaff set,
     * or when the linked user's linkedStaff points to a different staff record.
     */
    private String  integrityWarning;
}

