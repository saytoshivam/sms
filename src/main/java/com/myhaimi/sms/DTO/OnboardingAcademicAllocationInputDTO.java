package com.myhaimi.sms.DTO;

import jakarta.validation.constraints.Positive;

public record OnboardingAcademicAllocationInputDTO(
        Integer classGroupId,
        Integer subjectId,
        /** Optional: can be null and assigned later */
        Integer staffId,
        @Positive Integer weeklyFrequency,
        /** Optional: overrides class default room for this subject in this section */
        Integer roomId) {}
