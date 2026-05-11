package com.myhaimi.sms.DTO.staff;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * Request body for POST /api/staff/{staffId}/link-user.
 * Links an existing system user to this staff member.
 */
@Data
public class StaffLinkUserDTO {

    /**
     * Email of the existing user to link.
     * The user must already exist in the same school.
     */
    @NotBlank
    @Email
    private String email;
}

