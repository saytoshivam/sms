package com.myhaimi.sms.DTO;

import java.util.List;

public record OnboardingRoomsSetupResultDTO(
        int createdCount,
        int skippedExistingCount,
        List<String> createdKeys
) {}

