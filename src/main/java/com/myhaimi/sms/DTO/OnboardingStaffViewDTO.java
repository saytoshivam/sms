package com.myhaimi.sms.DTO;

import java.util.List;

public record OnboardingStaffViewDTO(
        Integer staffId,
        String fullName,
        String email,
        String phone,
        String employeeNo,
        String designation,
        List<String> roles,
        List<String> subjectCodes,
        boolean hasLoginAccount,
        Integer maxWeeklyLectureLoad,
        List<Integer> preferredClassGroupIds
) {}

