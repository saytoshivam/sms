package com.myhaimi.sms.DTO.student;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class GuardianUpdateDTO {

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

    @NotBlank
    @Size(max = 64)
    private String relation;

    private boolean receivesNotifications;

    private boolean canLogin;
}
