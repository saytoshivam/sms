package com.myhaimi.sms.DTO;

import com.myhaimi.sms.entity.enums.EmploymentType;
import com.myhaimi.sms.entity.enums.StaffType;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

import java.time.LocalDate;
import java.util.List;

public record OnboardingStaffCreateDTO(
        @NotBlank String fullName,
        /** Email is optional during onboarding; phone is the primary contact. */
        @Email String email,
        @NotBlank String phone,
        /** Optional employee number; if omitted, one is generated. */
        String employeeNo,
        @NotBlank String designation,
        /**
         * Staff functional category. Defaults to TEACHING when null.
         * TEACHING staff must also have the TEACHER role to appear in timetable assignment.
         */
        StaffType staffType,
        /** Roles to assign to the created login user (e.g. TEACHER, HOD, ACCOUNTANT). */
        List<String> roles,
        /** Subject ids this staff member can teach; used when staffType=TEACHING + TEACHER role. */
        List<Integer> teachableSubjectIds,
        /** If true, create a login account (User) linked to this Staff. */
        Boolean createLoginAccount,
        /** Max weekly teaching periods; null = system default in smart load balancing. */
        Integer maxWeeklyLectureLoad,
        /** Class group ids this teacher prefers (optional). */
        List<Integer> preferredClassGroupIds,
        LocalDate joiningDate,
        EmploymentType employmentType,
        String department
) {}