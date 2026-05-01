package com.myhaimi.sms.DTO;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ClassGroupDTO {
    private Integer id;

    @NotBlank
    @Pattern(regexp = "^[A-Za-z0-9]+(?:[-_][A-Za-z0-9]+)*$", message = "Code must be a simple identifier like '10-A' or 'nursery_blue'")
    private String code;

    @NotBlank
    private String displayName;

    /** Optional — same as wizard-generated classes (grade + section roster). */
    private Integer gradeLevel;

    @Size(max = 16)
    private String section;

    /** Optional capacity; only applied when greater than zero. */
    private Integer capacity;
}

