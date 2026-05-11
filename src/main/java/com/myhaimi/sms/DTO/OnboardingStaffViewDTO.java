package com.myhaimi.sms.DTO;

import com.myhaimi.sms.entity.enums.StaffStatus;
import com.myhaimi.sms.entity.enums.StaffType;

import java.util.List;

public record OnboardingStaffViewDTO(
        Integer staffId,
        String fullName,
        String email,
        String phone,
        String employeeNo,
        String designation,
        StaffType staffType,
        StaffStatus status,
        List<String> roles,
        List<String> subjectCodes,
        boolean hasLoginAccount,
        Integer maxWeeklyLectureLoad,
        List<Integer> preferredClassGroupIds,

        // ── Extended fields for directory + readiness ─────────────────────────
        /** Pre-computed: status=ACTIVE + staffType=TEACHING + TEACHER role + ≥1 subject. */
        boolean timetableEligible,
        /** Short human-readable reasons why not timetable eligible (empty list when eligible). */
        List<String> ineligibilityReasons,
        /** NOT_CREATED | ACTIVE | DISABLED | INVITED */
        String loginStatus,
        boolean canBeClassTeacher,
        boolean canTakeSubstitution,
        String department
) {}