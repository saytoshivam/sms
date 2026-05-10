package com.myhaimi.sms.DTO.student;

import lombok.Data;

/**
 * Response body returned by POST /api/students/{studentId}/create-login.
 */
@Data
public class StudentLoginCreateResultDTO {

    public enum Outcome { CREATED, ALREADY_EXISTS }

    private Outcome outcome;
    private Integer studentUserId;
    private String username;
    /** Temporary password — shown only once at creation time. Null when login already existed. */
    private String temporaryPassword;
    /** Current login status string. */
    private String loginStatus;
    /** Whether an invite was sent (future use). */
    private boolean inviteSent;
    private String message;

    public static StudentLoginCreateResultDTO created(Integer userId, String username, String tempPwd) {
        StudentLoginCreateResultDTO r = new StudentLoginCreateResultDTO();
        r.outcome = Outcome.CREATED;
        r.studentUserId = userId;
        r.username = username;
        r.temporaryPassword = tempPwd;
        r.loginStatus = "ACTIVE";
        r.inviteSent = false;
        r.message = "Student login created successfully.";
        return r;
    }

    public static StudentLoginCreateResultDTO alreadyExists(Integer userId, String username) {
        StudentLoginCreateResultDTO r = new StudentLoginCreateResultDTO();
        r.outcome = Outcome.ALREADY_EXISTS;
        r.studentUserId = userId;
        r.username = username;
        r.temporaryPassword = null;
        r.loginStatus = "ACTIVE";
        r.inviteSent = false;
        r.message = "Student login already exists.";
        return r;
    }
}

