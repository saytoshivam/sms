package com.myhaimi.sms.DTO;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

import java.util.List;

public record OnboardingStaffUpdateDTO(
        @NotBlank String fullName,
        @Email @NotBlank String email,
        @NotBlank String phone,
        String employeeNo,
        @NotBlank String designation,
        List<String> roles,
        List<Integer> teachableSubjectIds,
        Boolean createLoginAccount,
        Integer maxWeeklyLectureLoad,
        List<Integer> preferredClassGroupIds
) {}

