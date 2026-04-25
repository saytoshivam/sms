package com.myhaimi.sms.DTO;

import jakarta.validation.constraints.NotNull;

public record OnboardingClassDefaultRoomItemDTO(
        @NotNull Integer classGroupId,
        /** Null clears default room for this class. */
        Integer roomId
) {}
