package com.myhaimi.sms.DTO;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

import java.util.List;

public record OnboardingStaffCreateDTO(
        @NotBlank String fullName,
        @Email @NotBlank String email,
        @NotBlank String phone,
        /** Optional employee number; if omitted, one is generated. */
        String employeeNo,
        @NotBlank String designation,
        /** Roles to assign to the created login user (e.g. TEACHER, HOD, ACCOUNTANT). */
        List<String> roles,
        /** Subject ids this staff member can teach; used to suggest teachers in academic structure. */
        List<Integer> teachableSubjectIds,
        /** If true, create a login account (User) linked to this Staff. */
        Boolean createLoginAccount,
        /** Max weekly teaching periods; null = system default in smart load balancing. */
        Integer maxWeeklyLectureLoad,
        /** Class group ids this teacher prefers (optional). */
        List<Integer> preferredClassGroupIds
) {}

