package com.myhaimi.sms.DTO.student;

import lombok.Data;

/**
 * Response body returned by POST /api/students/{studentId}/guardians/{guardianId}/create-login.
 */
@Data
public class ParentLoginCreateResultDTO {

    public enum Outcome { CREATED, LINKED }

    private Outcome outcome;
    private Integer parentUserId;
    private String username;
    /** Temporary password — shown only once at creation time. Null when account was only linked. */
    private String temporaryPassword;
    private String message;

    public static ParentLoginCreateResultDTO created(Integer userId, String username, String tempPwd) {
        ParentLoginCreateResultDTO r = new ParentLoginCreateResultDTO();
        r.outcome = Outcome.CREATED;
        r.parentUserId = userId;
        r.username = username;
        r.temporaryPassword = tempPwd;
        r.message = "Parent login created successfully.";
        return r;
    }

    public static ParentLoginCreateResultDTO linked(Integer userId, String username) {
        ParentLoginCreateResultDTO r = new ParentLoginCreateResultDTO();
        r.outcome = Outcome.LINKED;
        r.parentUserId = userId;
        r.username = username;
        r.temporaryPassword = null;
        r.message = "Existing parent account linked.";
        return r;
    }
}

