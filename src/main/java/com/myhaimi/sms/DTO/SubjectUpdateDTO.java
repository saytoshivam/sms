package com.myhaimi.sms.DTO;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SubjectUpdateDTO(
        @NotBlank @Size(max = 128) String name,
        @NotBlank @Size(min = 3, max = 32) String code) {}
