package com.myhaimi.sms.DTO.staff.onboarding;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.time.LocalDate;

/** Personal identity and primary contact details. */
@Data
public class StaffIdentityDTO {

    @NotBlank(message = "Full name is required.")
    private String fullName;

    /** Optional — auto-generated if blank. */
    private String employeeNo;

    /** MALE / FEMALE / OTHER / PREFER_NOT_TO_SAY */
    private String gender;

    private LocalDate dateOfBirth;

    private String photoUrl;

    @NotBlank(message = "Phone number is required.")
    private String phone;

    private String alternatePhone;

    /**
     * Optional — required only when {@code rolesAndAccess.createLoginAccount = true}.
     * Validated cross-field in the service layer.
     */
    @Email(message = "Provide a valid email address.")
    private String email;
}
