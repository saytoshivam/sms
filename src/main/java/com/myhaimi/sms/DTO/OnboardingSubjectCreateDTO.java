package com.myhaimi.sms.DTO;

import jakarta.annotation.Nullable;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record OnboardingSubjectCreateDTO(
        @NotBlank String name,
        @NotBlank String code,
        /**
         * Optional defaults (legacy / hint only).
         *
         * <p>In the optimized onboarding flow, type and weeklyFrequency are configured per class group inside Academic
         * Structure. These fields are accepted for backwards compatibility but are not required.</p>
         */
        @Nullable String type,
        @NotNull @Positive Integer weeklyFrequency,
        /**
         * Optional; values like STANDARD_CLASSROOM, LAB_REQUIRED, ACTIVITY_SPACE, SPORTS_AREA, SPECIALIZED_ROOM, FLEXIBLE.
         * Blank or omitted defaults to STANDARD_CLASSROOM on the server.
         */
        @Nullable String allocationVenueRequirement,
        /** Optional; {@link com.myhaimi.sms.entity.RoomType} name when requirement is SPECIALIZED_ROOM. */
        @Nullable String specializedVenueType
) {}

