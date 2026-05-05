package com.myhaimi.sms.DTO;

public record OnboardingAcademicClassGroupItemDTO(
        int classGroupId,
        String code,
        String displayName,
        Integer gradeLevel,
        String section,
        Integer defaultRoomId,
        Integer classTeacherStaffId,
        boolean homeroomLocked,
        /** Lowercase {@code auto} or {@code manual}, or null. */
        String homeroomSource,
        /** Lowercase {@code auto} or {@code manual}, or null. */
        String classTeacherSource,
        boolean classTeacherLocked) {}
