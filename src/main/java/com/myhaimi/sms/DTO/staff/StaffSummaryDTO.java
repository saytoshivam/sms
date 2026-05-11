package com.myhaimi.sms.DTO.staff;

import com.myhaimi.sms.entity.enums.EmploymentType;
import com.myhaimi.sms.entity.enums.StaffStatus;
import com.myhaimi.sms.entity.enums.StaffType;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;

/**
 * Lightweight projection of a Staff record — safe for list responses.
 * Does NOT include sensitive payroll / bank fields.
 */
@Data
public class StaffSummaryDTO {

    private Integer id;
    private String  employeeNo;
    private String  fullName;
    private String  designation;
    private String  phone;
    private String  email;
    private String  photoUrl;

    // Classification
    private StaffType      staffType;
    private StaffStatus    status;
    private EmploymentType employmentType;
    private String         department;
    private LocalDate      joiningDate;

    // Teaching capability
    private List<String>  roles;
    private List<String>  teachableSubjectCodes;
    private boolean       hasLoginAccount;
    private Integer       maxWeeklyLectureLoad;
    private Integer       maxDailyLectureLoad;
    private boolean       canBeClassTeacher;
    private boolean       canTakeSubstitution;
    /** Class groups this teacher prefers for assignment (soft preference). */
    private List<Integer> preferredClassGroupIds;
    /** Class groups this teacher must NOT be assigned to (hard restriction). */
    private List<Integer> restrictedClassGroupIds;

    // Qualifications (summary only)
    private String  specialization;
    private Integer yearsOfExperience;

    // ── Computed / derived fields ──────────────────────────────────────────────

    /**
     * NONE / ACTIVE — indicates whether a login account exists for this staff member.
     * Future: INVITED when pending first login.
     */
    private String loginStatus;

    /**
     * True when: staffType = TEACHING + roles includes TEACHER + ≥1 teachable subject.
     * Tells the UI whether this staff member can be assigned in the timetable.
     */
    private boolean timetableEligible;

    /**
     * Human-readable list of things still missing before the profile is production-ready.
     * Example items: "Joining date required before activation", "No teachable subjects assigned".
     */
    private List<String> missingRequiredItems;

    private java.time.Instant createdAt;
    private java.time.Instant updatedAt;
}

