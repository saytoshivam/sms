package com.myhaimi.sms.DTO;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class ClassGroupDTO {
    private Integer id;

    @NotBlank
    @Pattern(regexp = "^[A-Za-z0-9]+(?:[-_][A-Za-z0-9]+)*$", message = "Code must be a simple identifier like '10-A' or 'nursery_blue'")
    private String code;

    @NotBlank
    private String displayName;
}

