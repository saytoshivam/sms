package com.myhaimi.sms.DTO;

import com.myhaimi.sms.entity.enums.EmploymentType;
import com.myhaimi.sms.entity.enums.StaffStatus;
import com.myhaimi.sms.entity.enums.StaffType;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

import java.time.LocalDate;
import java.util.List;

public record OnboardingStaffUpdateDTO(
        @NotBlank String fullName,
        @Email @NotBlank String email,
        @NotBlank String phone,
        String employeeNo,
        @NotBlank String designation,
        StaffType staffType,
        StaffStatus status,
        List<String> roles,
        List<Integer> teachableSubjectIds,
        Boolean createLoginAccount,
        Integer maxWeeklyLectureLoad,
        List<Integer> preferredClassGroupIds,
        LocalDate joiningDate,
        EmploymentType employmentType,
        String department
) {}