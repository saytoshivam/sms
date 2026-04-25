package com.myhaimi.sms.DTO;

import java.util.List;

public record OnboardingStaffSetupResultDTO(
        int staffCreated,
        int usersCreated,
        int skippedExistingCount,
        List<OnboardingStaffUserCredentialDTO> credentials
) {}

