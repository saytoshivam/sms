package com.myhaimi.sms.DTO.staff;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

/**
 * Request body for POST /api/staff/{staffId}/create-login.
 * If email is omitted the staff member's existing email is used.
 */
@Data
public class StaffCreateLoginDTO {

    @Email
    @Size(max = 128)
    private String email;

    /** Preferred portal username. Derived from email if blank. */
    @Size(max = 64)
    private String username;

    /**
     * Roles to assign to the new user.
     * If null/empty, the staff member's current roles are used.
     */
    private List<String> roles;
}

