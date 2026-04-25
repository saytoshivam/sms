package com.myhaimi.sms.DTO;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class LoginDTO {
    @NotBlank(message = "Username is required")
    private String username;
    @NotBlank(message = "Password is required")
    @NotNull
    private String password;
}
