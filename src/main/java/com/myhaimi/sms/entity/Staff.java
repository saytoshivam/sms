package com.myhaimi.sms.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.myhaimi.sms.entity.enums.EmploymentType;
import com.myhaimi.sms.entity.enums.SalaryType;
import com.myhaimi.sms.entity.enums.StaffStatus;
import com.myhaimi.sms.entity.enums.StaffType;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;

@Getter
@Setter
@Entity
@Table(name = "staff", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"school_id", "employee_no"})
})
public class Staff {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "school_id", nullable = false)
    private School school;

    @Column(name = "employee_no", nullable = false, length = 64)
    private String employeeNo;

    @Column(nullable = false, length = 128)
    private String fullName;

    @Column(length = 64)
    private String designation; // Teacher, Accountant, etc.

    @Column(length = 32)
    private String phone;

    @Column(length = 32)
    private String alternatePhone;

    @Column(length = 128)
    private String email;

    /** Optional portrait URL (CDN / generated avatar). */
    @Column(name = "photo_url", length = 512)
    private String photoUrl;

    // ── Staff classification ──────────────────────────────────────────────────

    @Enumerated(EnumType.STRING)
    @Column(name = "staff_type", nullable = false, length = 32)
    private StaffType staffType = StaffType.TEACHING;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private StaffStatus status = StaffStatus.DRAFT;

    @Column(length = 16)
    private String gender;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @Column(name = "joining_date")
    private LocalDate joiningDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "employment_type", length = 32)
    private EmploymentType employmentType;

    @Column(length = 128)
    private String department;

    /** FK to another staff row; nullable — no hard FK to avoid circular constraints. */
    @Column(name = "reporting_manager_staff_id")
    private Integer reportingManagerStaffId;

    // ── Address ───────────────────────────────────────────────────────────────

    @Column(name = "current_address_line1", length = 255)
    private String currentAddressLine1;

    @Column(name = "current_address_line2", length = 255)
    private String currentAddressLine2;

    @Column(length = 128)
    private String city;

    @Column(length = 128)
    private String state;

    @Column(length = 16)
    private String pincode;

    // ── Emergency contact ─────────────────────────────────────────────────────

    @Column(name = "emergency_contact_name", length = 128)
    private String emergencyContactName;

    @Column(name = "emergency_contact_phone", length = 32)
    private String emergencyContactPhone;

    @Column(name = "emergency_contact_relation", length = 64)
    private String emergencyContactRelation;

    // ── Qualifications ────────────────────────────────────────────────────────

    @Column(name = "highest_qualification", length = 128)
    private String highestQualification;

    @Column(name = "professional_qualification", length = 255)
    private String professionalQualification;

    @Column(length = 255)
    private String specialization;

    @Column(name = "years_of_experience")
    private Integer yearsOfExperience;

    @Column(name = "previous_institution", length = 255)
    private String previousInstitution;

    // ── Payroll ───────────────────────────────────────────────────────────────

    @Enumerated(EnumType.STRING)
    @Column(name = "salary_type", length = 32)
    private SalaryType salaryType;

    @Column(name = "payroll_enabled", nullable = false)
    private boolean payrollEnabled = false;

    @Column(name = "bank_account_holder_name", length = 128)
    private String bankAccountHolderName;

    @Column(name = "bank_name", length = 128)
    private String bankName;

    /** Stored as plain text — masked in DTO responses. Never serialised directly. */
    @Column(name = "bank_account_number", length = 64)
    private String bankAccountNumber;

    @Column(length = 16)
    private String ifsc;

    /** Stored as plain text — masked in DTO responses. Never serialised directly. */
    @Column(name = "pan_number", length = 16)
    private String panNumber;

    // ── Timetable preferences (existing) ──────────────────────────────────────

    @Column(name = "max_weekly_lecture_load")
    private Integer maxWeeklyLectureLoad;

    /** Optional per-day cap. Null = no daily cap enforced. */
    @Column(name = "max_daily_lecture_load")
    private Integer maxDailyLectureLoad;

    /** Whether this staff member can be assigned as a class teacher. */
    @Column(name = "can_be_class_teacher", nullable = false)
    private boolean canBeClassTeacher = true;

    /** Whether this staff member is available for substitution duties. */
    @Column(name = "can_take_substitution", nullable = false)
    private boolean canTakeSubstitution = true;

    @Column(name = "preferred_class_group_ids", columnDefinition = "json")
    private String preferredClassGroupIdsJson;

    /**
     * Class groups this teacher must NOT be assigned to.
     * Stored as a JSON integer array, e.g. [3, 7, 12].
     * Null = no restrictions.
     */
    @Column(name = "restricted_class_group_ids_json", columnDefinition = "json")
    private String restrictedClassGroupIdsJson;

    /**
     * Placeholder for future unavailability windows (day + slot pairs).
     * Stored as raw JSON; not yet enforced by the timetable scheduler.
     * Format subject to change — treat as opaque until the scheduler module reads it.
     */
    @Column(name = "unavailable_periods_json", columnDefinition = "json")
    private String unavailablePeriodsJson;

    /**
     * First-class staff role assignment stored as a JSON array of role name strings.
     * Example: {@code ["TEACHER","HOD"]}
     * <p>
     * This field is the authoritative source for staff roles and is populated
     * @deprecated Superseded by {@link com.myhaimi.sms.entity.StaffRoleMapping}.
     *             {@code StaffRoleMapping} is the authoritative source for staff roles.
     *             This column is kept for backward-compatibility (migration fallback only)
     *             and will be removed once all records have been backfilled into
     *             {@code staff_role_mapping}.  No new code should write to this field.
     */
    @Deprecated
    @Column(name = "staff_roles_json", columnDefinition = "json")
    private String staffRolesJson;

    // ── Audit ──────────────────────────────────────────────────────────────────

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "created_by")
    private String createdBy;

    @Column(name = "updated_by")
    private String updatedBy;

    @Column(name = "is_deleted", nullable = false)
    private boolean isDeleted = false;

    public void setDeleted(boolean deleted) {
        this.isDeleted = deleted;
    }

    @PrePersist
    public void prePersist() {
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
        if (staffType == null) staffType = StaffType.TEACHING;
        if (status == null) status = StaffStatus.DRAFT;
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = Instant.now();
    }
}

