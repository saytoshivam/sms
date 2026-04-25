package com.myhaimi.sms.DTO;

import java.util.List;

public record OnboardingStaffUserCredentialDTO(
        String email,
        String username,
        String temporaryPassword,
        List<String> roles
) {}

