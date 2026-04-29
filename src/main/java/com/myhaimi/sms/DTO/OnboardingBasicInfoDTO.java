package com.myhaimi.sms.DTO;

import com.myhaimi.sms.entity.AttendanceMode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

import java.util.List;

public record OnboardingBasicInfoDTO(
        @NotBlank String academicYear,
        /** 1-12 (April typical = 4). */
        @NotNull Integer startMonth,
        /** Example: ["MON","TUE","WED","THU","FRI","SAT"] */
        @NotEmpty List<String> workingDays,
        /** How attendance is taken: DAILY (homeroom) vs LECTURE_WISE (per lecture). */
        @NotNull AttendanceMode attendanceMode,
        /** Optional: multiple open windows in a day (e.g. 09:00-13:00 and 14:00-17:00). */
        List<OnboardingBasicInfoTimeWindowDTO> openWindows,
        /** School open time (HH:mm) e.g. "09:00" */
        @NotBlank String schoolStartTime,
        /** School close time (HH:mm) e.g. "17:00" */
        @NotBlank String schoolEndTime,
        /** Default lecture duration in minutes used to auto-generate timetable slots. */
        @NotNull @Min(10) @Max(240) Integer lectureDurationMinutes
) {}

