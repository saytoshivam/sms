package com.myhaimi.sms.DTO;

import jakarta.validation.constraints.NotBlank;

public record OnboardingBasicInfoTimeWindowDTO(
        /** HH:mm */
        @NotBlank String startTime,
        /** HH:mm */
        @NotBlank String endTime
) {}

