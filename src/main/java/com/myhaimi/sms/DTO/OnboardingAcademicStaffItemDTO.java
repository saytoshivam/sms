package com.myhaimi.sms.DTO;

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
        List<Integer> preferredClassGroupIds) {}
