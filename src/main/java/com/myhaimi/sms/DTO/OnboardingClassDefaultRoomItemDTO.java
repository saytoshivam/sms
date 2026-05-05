package com.myhaimi.sms.DTO;

import jakarta.validation.constraints.NotNull;

public record OnboardingClassDefaultRoomItemDTO(
        @NotNull Integer classGroupId,
        /** Null clears default room for this class. */
        Integer roomId,
        /** When true, bulk homeroom automation must not overwrite this section's room. */
        Boolean homeroomLocked,
        /** Optional provenance: lowercase {@code auto} or {@code manual}; null leaves stored value unchanged when room is set. */
        String homeroomSource
) {}
