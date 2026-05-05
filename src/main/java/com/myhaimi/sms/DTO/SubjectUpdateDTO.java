package com.myhaimi.sms.DTO;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SubjectUpdateDTO(
        @NotBlank @Size(max = 128) String name,
        @NotBlank @Size(min = 3, max = 32) String code,
        /** Optional; when provided updates the default timetable hint. */
        Integer weeklyFrequency,
        /**
         * Optional; when non-blank updates {@link com.myhaimi.sms.entity.Subject#getAllocationVenueRequirement()}.
         * Values: STANDARD_CLASSROOM, LAB_REQUIRED, ACTIVITY_SPACE, SPORTS_AREA, SPECIALIZED_ROOM, FLEXIBLE.
         */
        String allocationVenueRequirement,
        /** Optional; {@link com.myhaimi.sms.entity.RoomType} name when requirement is SPECIALIZED_ROOM. */
        String specializedVenueType) {}
