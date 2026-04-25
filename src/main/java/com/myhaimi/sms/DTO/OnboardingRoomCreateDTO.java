package com.myhaimi.sms.DTO;

import jakarta.validation.constraints.NotBlank;

public record OnboardingRoomCreateDTO(
        @NotBlank String building,
        /** Optional floor label e.g. Ground / 1 / 2 */
        String floor,
        Integer floorNumber,
        String floorName,
        @NotBlank String roomNumber,
        /** CLASSROOM/LAB/LIBRARY/AUDITORIUM/SPORTS_ROOM/STAFF_ROOM/OFFICE/OTHER */
        @NotBlank String type,
        Integer capacity,
        /** PHYSICS/CHEMISTRY/COMPUTER/OTHER - only for LAB */
        String labType
) {}

