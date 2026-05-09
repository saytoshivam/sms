package com.myhaimi.sms.DTO.student;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class GuardianLinkPayloadDTO {

    @NotBlank
    @Size(max = 128)
    private String name;

    @NotBlank
    @Size(max = 32)
    private String phone;

    @Email
    @Size(max = 128)
    private String email;

    @Size(max = 128)
    private String occupation;

    @Size(max = 255)
    private String addressLine1;

    @Size(max = 255)
    private String addressLine2;

    @Size(max = 128)
    private String city;

    @Size(max = 128)
    private String state;

    @Size(max = 16)
    private String pincode;

    @NotBlank
    @Size(max = 64)
    private String relation;

    /** Must be exactly one {@code true} across all guardians on create. Default false — set explicitly when needed. */
    private boolean primaryGuardian;

    private boolean canLogin;

    /** Defaults to true when omitted in JSON (primitive default). */
    private boolean receivesNotifications = true;
}
