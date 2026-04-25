package com.myhaimi.sms.DTO;

import java.util.List;

/**
 * Staff / family logins scoped to this school (for access visibility).
 * Name/photo come from linked staff or student profile when present.
 */
public record SchoolUserRowDTO(
        int userId,
        String email,
        String displayName,
        String photoUrl,
        List<String> roles) {}
