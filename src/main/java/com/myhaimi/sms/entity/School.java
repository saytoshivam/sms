package com.myhaimi.sms.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.myhaimi.sms.theme.AppThemeDefaults;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.time.LocalTime;
import java.util.Set;

@Data
@Entity
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
@Table(name = "schools", uniqueConstraints = {
        @UniqueConstraint(columnNames = "code")
})
public class School {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false)
    private String name;

    /**
     * Human-friendly unique identifier used for login/tenant selection.
     * Example: "greenwood-high"
     */
    @Column(nullable = false, length = 64)
    private String code;

    /**
     * Optional school email/domain hint (e.g. {@code greenwood.edu}).
     * Used for onboarding UX and future SSO / allowlist logic.
     */
    @Column(length = 255)
    private String domain;

    /**
     * School-configurable UI theme (hex colors).
     * These are applied by the web client via CSS variables.
     */
    @Column(nullable = false, length = 16)
    private String primaryColor = AppThemeDefaults.PRIMARY;

    @Column(nullable = false, length = 16)
    private String accentColor = AppThemeDefaults.ACCENT;

    @Column(nullable = false, length = 16)
    private String backgroundColor = AppThemeDefaults.BACKGROUND;

    @Column(nullable = false, length = 16)
    private String textColor = AppThemeDefaults.TEXT;

    @Column(nullable = false, length = 16)
    private String navTextColor = AppThemeDefaults.NAV_TEXT;

    /**
     * When true, tenant users cannot authenticate; super admins retain access for recovery.
     */
    @Column(nullable = false)
    private boolean archived = false;

    /**
     * Whether attendance is taken once per day for the class (class teacher) or per lecture (subject teacher).
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "attendance_mode", nullable = false, length = 32)
    private AttendanceMode attendanceMode = AttendanceMode.LECTURE_WISE;

    /**
     * When set, daily section attendance not locked by this local time triggers admin alerts (server default zone).
     */
    @Column(name = "attendance_daily_cutoff")
    private LocalTime attendanceDailyCutoff;

    /**
     * Minutes after each lecture’s end time during which subject teachers may mark attendance ({@link AttendanceMode#LECTURE_WISE}).
     */
    @Column(name = "attendance_lecture_grace_minutes", nullable = false)
    private int attendanceLectureGraceMinutes = 15;

    /**
     * Onboarding progress tracker for the tenant setup wizard.
     * Stored on the school row so the UI can quickly decide whether to show the wizard.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "onboarding_status", nullable = false, length = 32)
    private OnboardingStatus onboardingStatus = OnboardingStatus.BASIC_INFO;

    /**
     * Completed onboarding steps (set of {@link OnboardingStatus} names) serialized as JSON.
     * We store it as JSON so future steps can be added without schema changes.
     */
    @Column(name = "onboarding_completed", columnDefinition = "json")
    private String onboardingCompletedJson;

    /** Basic setup step payload: academic year, start month, working days, default time slots, etc. */
    @Column(name = "onboarding_basic_info", columnDefinition = "json")
    private String onboardingBasicInfoJson;

    /** Fees setup payload: class-wise fee, installments, due dates, late fee rules. */
    @Column(name = "onboarding_fees", columnDefinition = "json")
    private String onboardingFeesJson;

    /**
     * Step 6 — per (section, subject) assignment source + lock for smart teacher assign / rebalance.
     * JSON array of {@code OnboardingAcademicSlotMetaDTO}-compatible objects.
     */
    @Column(name = "onboarding_academic_assignment_meta", columnDefinition = "json")
    private String onboardingAcademicAssignmentMetaJson;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;
}

