package com.myhaimi.sms.DTO.staff.onboarding;

import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.util.List;

/** Timetable eligibility and teaching load configuration. */
@Data
public class StaffAcademicCapabilitiesDTO {

    /**
     * Subject IDs this staff member can teach.
     * Required when the TEACHER role is assigned; otherwise ignored.
     */
    private List<Integer> teachableSubjectIds;

    /** Maximum lectures per week. Null = no cap (system default in load balancer). */
    @Positive(message = "maxWeeklyLectureLoad must be a positive number.")
    private Integer maxWeeklyLectureLoad;

    /** Maximum lectures per day. Null = no daily cap. */
    @Positive(message = "maxDailyLectureLoad must be a positive number.")
    private Integer maxDailyLectureLoad;

    /** Whether this staff member is eligible for class-teacher assignment. Default true. */
    private Boolean canBeClassTeacher;

    /** Whether this staff member is available for substitution duties. Default true. */
    private Boolean canTakeSubstitution;

    /** Class group IDs this teacher prefers for assignment (soft preference). */
    private List<Integer> preferredClassGroupIds;

    /**
     * Class group IDs this teacher must NOT be assigned to (hard restriction).
     * When set, the timetable engine and smart-assignment will skip these class groups
     * for this teacher.
     */
    private List<Integer> restrictedClassGroupIds;

    /**
     * Placeholder for future unavailability windows.
     * Accepted as opaque JSON string; not yet enforced by the scheduler.
     * Example future format: [{"day":"MONDAY","slotNo":1},{"day":"FRIDAY","slotNo":5}]
     */
    private String unavailablePeriodsJson;
}


