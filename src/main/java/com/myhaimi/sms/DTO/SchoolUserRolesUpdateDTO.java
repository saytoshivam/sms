package com.myhaimi.sms.DTO;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record SchoolUserRolesUpdateDTO(
        @NotNull @Size(min = 1, message = "At least one role is required")
        List<@NotBlank String> roles
) {}
