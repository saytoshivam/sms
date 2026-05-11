package com.myhaimi.sms.DTO.staff.onboarding;

import com.myhaimi.sms.DTO.staff.StaffProfileDTO;

import java.util.List;

/**
 * Response envelope for staff onboard / update-onboard operations.
 *
 * <ul>
 *   <li>{@code staff}        — always present; full masked profile</li>
 *   <li>{@code warnings}     — non-fatal business-rule warnings (e.g. TEACHER role but no subjects)</li>
 *   <li>{@code tempPassword} — non-null only when a new login account was just created</li>
 * </ul>
 */
public record StaffOnboardingResult(
        StaffProfileDTO staff,
        List<String>    warnings,
        String          tempPassword
) {}
