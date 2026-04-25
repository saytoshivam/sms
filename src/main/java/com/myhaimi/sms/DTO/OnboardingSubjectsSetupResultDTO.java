package com.myhaimi.sms.DTO;

import java.util.List;

public record OnboardingSubjectsSetupResultDTO(
        int createdCount,
        int skippedExistingCount,
        int mappingsCreated,
        List<String> createdSubjectCodes
) {}

