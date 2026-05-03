package com.myhaimi.sms.DTO;

public record OnboardingAcademicClassGroupItemDTO(
        int classGroupId,
        String code,
        String displayName,
        Integer gradeLevel,
        String section,
        Integer defaultRoomId,
        Integer classTeacherStaffId) {}
