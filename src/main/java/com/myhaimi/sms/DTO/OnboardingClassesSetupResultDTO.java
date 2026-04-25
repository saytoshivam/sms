package com.myhaimi.sms.DTO;

import java.util.List;

public record OnboardingClassesSetupResultDTO(
        int createdCount,
        List<String> createdCodes,
        int skippedExistingCount
) {}

