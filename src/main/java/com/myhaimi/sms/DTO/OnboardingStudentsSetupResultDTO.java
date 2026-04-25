package com.myhaimi.sms.DTO;

public record OnboardingStudentsSetupResultDTO(
        int studentsCreated,
        int guardiansCreated,
        int skippedExistingCount
) {}

