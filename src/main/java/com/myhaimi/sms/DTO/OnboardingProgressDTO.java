package com.myhaimi.sms.DTO;

import java.util.List;

public record OnboardingProgressDTO(
        String onboardingStatus,
        List<String> completedSteps
) {}

