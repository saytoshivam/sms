package com.myhaimi.sms.DTO;

import com.myhaimi.sms.entity.enums.StaffStatus;
import com.myhaimi.sms.entity.enums.StaffType;

import java.util.List;

public record OnboardingAcademicStaffItemDTO(
        int id,
        String fullName,
        String email,
        List<Integer> teachableSubjectIds,
        /** From linked login user, if any */
        List<String> roleNames,
        /** Null = use platform default in UI when smart-assigning. */
        Integer maxWeeklyLectureLoad,
        /** Preferred class/section group ids (soft signal for auto-assign). */
        List<Integer> preferredClassGroupIds,

        // ── Smart-assignment eligibility fields ───────────────────────────────
        /** TEACHING | NON_TEACHING | ADMIN | SUPPORT. */
        StaffType staffType,
        /** Only ACTIVE staff are eligible for auto-assignment. */
        StaffStatus status,
        /** False → must not appear in class-teacher auto-pick list. */
        boolean canBeClassTeacher,
        /** False → must not appear in substitution suggestion lists. */
        boolean canTakeSubstitution,
        /** Pre-computed: status=ACTIVE + staffType=TEACHING + TEACHER role + ≥1 subject. */
        boolean timetableEligible,
        /** Short human-readable reasons why this staff is not timetable eligible (empty when eligible). */
        List<String> ineligibilityReasons) {}
