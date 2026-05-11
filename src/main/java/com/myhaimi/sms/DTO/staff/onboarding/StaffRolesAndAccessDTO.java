package com.myhaimi.sms.DTO.staff.onboarding;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

/** Login provisioning and role assignment. */
@Data
public class StaffRolesAndAccessDTO {

    /**
     * School roles to assign (e.g. TEACHER, HOD, ACCOUNTANT).
     * At least one role is required.
     */
    @NotEmpty(message = "At least one role is required.")
    private List<String> roles;

    /**
     * When true the service creates (or updates) a User login account for this staff member.
     * Requires {@code identity.email} to be present.
     */
    private boolean createLoginAccount = false;

    /**
     * Future: trigger an email/SMS invite after account creation.
     * Currently stored but not acted upon — reserved for notification module.
     */
    private boolean sendInvite = false;

    /**
     * Preferred login username. When null the service derives one from the email.
     * Uniqueness is enforced globally across the users table.
     */
    private String username;
}
