package com.myhaimi.sms.modules.exam.entity;

import com.myhaimi.sms.entity.AcademicYear;
import com.myhaimi.sms.entity.ClassGroup;
import com.myhaimi.sms.entity.Room;
import com.myhaimi.sms.entity.School;
import com.myhaimi.sms.entity.Subject;
import com.myhaimi.sms.modules.exam.entity.enums.AssessmentInstanceStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;

@Getter
@Setter
@Entity
@Table(name = "assessment_instances", indexes = {
        @Index(name = "idx_ai_school_ay", columnList = "school_id, academic_year_id"),
        @Index(name = "idx_ai_class_subject", columnList = "class_group_id, subject_id"),
        @Index(name = "idx_ai_scheme_component", columnList = "scheme_id, component_id"),
        @Index(name = "idx_ai_status", columnList = "status")
}, uniqueConstraints = {
        @UniqueConstraint(name = "uk_ai_name_scope", columnNames = {"school_id", "component_id", "class_group_id", "subject_id", "name"})
})
public class AssessmentInstance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "school_id", nullable = false)
    private School school;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "academic_year_id", nullable = false)
    private AcademicYear academicYear;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "scheme_id", nullable = false)
    private AssessmentScheme scheme;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "component_id", nullable = false)
    private AssessmentComponent component;

    @Column(nullable = false, length = 128)
    private String name;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "subject_id", nullable = false)
    private Subject subject;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "class_group_id", nullable = false)
    private ClassGroup classGroup;

    @Column(name = "assessment_date")
    private LocalDate assessmentDate;

    @Column(name = "start_time")
    private LocalTime startTime;

    @Column(name = "end_time")
    private LocalTime endTime;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id")
    private Room room;

    @Column(name = "max_marks", nullable = false, precision = 6, scale = 2)
    private BigDecimal maxMarks;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private AssessmentInstanceStatus status = AssessmentInstanceStatus.DRAFT;

    @Column(nullable = false)
    private Integer sequence;

    /**
     * Optional batch identifier grouping all instances generated together
     * (e.g. from one "Generate from Scheme" run).
     */
    @Column(name = "schedule_group_id", length = 64)
    private String scheduleGroupId;

    /** Optional per-instance exam instructions visible to invigilators/students. */
    @Column(name = "instructions", columnDefinition = "TEXT")
    private String instructions;

    /**
     * Staff ID of the teacher assigned as scheduling owner, derived from the published timetable
     * at generation time (for DELEGATED / HYBRID components only).
     * Read-only after creation; null for CENTRALIZED components.
     */
    @Column(name = "assigned_teacher_staff_id")
    private Integer assignedTeacherStaffId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}

