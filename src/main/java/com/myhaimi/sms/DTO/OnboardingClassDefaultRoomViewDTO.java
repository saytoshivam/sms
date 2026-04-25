package com.myhaimi.sms.DTO;

/**
 * One class group with its optional default (homeroom) room.
 */
public record OnboardingClassDefaultRoomViewDTO(
        Integer classGroupId,
        String code,
        String displayName,
        Integer gradeLevel,
        String section,
        Integer defaultRoomId
) {}
