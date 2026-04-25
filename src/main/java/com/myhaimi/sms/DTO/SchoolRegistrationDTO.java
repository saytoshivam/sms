package com.myhaimi.sms.DTO;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class SchoolRegistrationDTO {
    @NotBlank(message = "School name is required")
    private String schoolName;

    @NotBlank(message = "School code is required")
    @Pattern(regexp = "^[a-z0-9]+(?:-[a-z0-9]+)*$", message = "School code must be lowercase slug like 'greenwood-high'")
    private String schoolCode;

    @NotBlank(message = "Admin username is required")
    private String adminUsername;

    @NotBlank(message = "Admin password is required")
    private String adminPassword;

    @NotBlank(message = "Admin email is required")
    @Email(message = "Invalid email format")
    private String adminEmail;

    /** Optional tenant email/domain hint (e.g. {@code greenwood.edu}). */
    private String domain;

    /** Subscription plan code (e.g. {@code basic}, {@code standard}). */
    @NotBlank(message = "Plan is required")
    private String planCode;
}

