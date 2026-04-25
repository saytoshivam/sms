package com.myhaimi.sms.DTO;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record OnboardingStudentCreateDTO(
        @NotBlank String admissionNo,
        @NotBlank String firstName,
        String lastName,
        Integer classGroupId,
        /** Optional code like "10-A" (used when classGroupId not supplied). */
        String classGroupCode,
        String guardianName,
        String guardianRelation,
        String guardianPhone,
        @Email String guardianEmail
) {}

