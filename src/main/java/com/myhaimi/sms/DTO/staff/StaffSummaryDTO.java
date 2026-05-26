package com.myhaimi.sms.DTO.staff;

import com.myhaimi.sms.entity.enums.EmploymentType;
import com.myhaimi.sms.entity.enums.StaffStatus;
import com.myhaimi.sms.entity.enums.StaffType;
import lombok.Data;

import java.time.Instant;
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
    /** FK to file_objects.id — use GET /api/files/{id}/content to fetch the blob. Null if no photo uploaded. */
    private Integer profilePhotoFileId;

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
    private Integer       userId;
    private String        username;
    private Instant       lastInviteSentAt;
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
     * True when: staffType = TEACHING + roles includes TEACHER + ≥1 teachable subject
     *            + maxWeeklyLectureLoad is set or a school default exists.
     * Tells the UI whether this staff member can be assigned in the timetable.
     */
    private boolean timetableEligible;

    /**
     * When {@code timetableEligible} is false, this list explains why.
     * Empty when the staff is eligible.
     */
    private List<String> timetableEligibilityReasons;

    /**
     * Human-readable list of things still missing before the profile is production-ready.
     * Example items: "Joining date required before activation", "No teachable subjects assigned".
     */
    private List<String> missingRequiredItems;

    /**
     * True when status = ACTIVE but one or more required activation fields are missing:
     * fullName, phone, staffType, designation, joiningDate, or at least one role.
     * The UI should show a prominent "Status is inconsistent" warning and offer to fix or deactivate.
     */
    private boolean activationInconsistent;

    private java.time.Instant createdAt;
    private java.time.Instant updatedAt;
}

