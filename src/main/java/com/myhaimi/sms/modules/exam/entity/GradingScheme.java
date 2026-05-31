package com.myhaimi.sms.modules.exam.entity;

import com.myhaimi.sms.entity.AcademicYear;
import com.myhaimi.sms.entity.ClassGroup;
import com.myhaimi.sms.entity.School;
import com.myhaimi.sms.modules.exam.entity.enums.GradingSchemeScope;
import com.myhaimi.sms.modules.exam.entity.enums.GradingSchemeStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * A reusable grading scheme (e.g. "CBSE 10-point scale") for a school.
 * Optional effective academic-year bounds constrain when it applies.
 */
@Getter
@Setter
@Entity
@Table(name = "grading_schemes", indexes = {
        @Index(name = "idx_gs_school", columnList = "school_id"),
        @Index(name = "idx_gs_academic_year", columnList = "academic_year_id"),
        @Index(name = "idx_gs_effective_from", columnList = "effective_from_academic_year_id"),
        @Index(name = "idx_gs_effective_to", columnList = "effective_to_academic_year_id"),
        @Index(name = "idx_gs_scope_class", columnList = "scope,class_group_id"),
        @Index(name = "idx_gs_status", columnList = "status")
})
public class GradingScheme {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "school_id", nullable = false)
    private School school;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "academic_year_id")
    private AcademicYear academicYear;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private GradingSchemeScope scope = GradingSchemeScope.SCHOOL;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "class_group_id")
    private ClassGroup classGroup;

    @Column(name = "default_scheme", nullable = false)
    private boolean defaultScheme = true;

    @Column(name = "passing_percent", nullable = false, precision = 5, scale = 2)
    private java.math.BigDecimal passingPercent = new java.math.BigDecimal("33.00");

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "effective_from_academic_year_id")
    private AcademicYear effectiveFromAcademicYear;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "effective_to_academic_year_id")
    private AcademicYear effectiveToAcademicYear;

    @Column(nullable = false, length = 128)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private GradingSchemeStatus status = GradingSchemeStatus.DRAFT;

    /** Legacy active flag retained for older callers; status is the source of truth. */
    @Column(nullable = false)
    private boolean active = false;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @OneToMany(mappedBy = "gradingScheme", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sequence ASC")
    private List<GradingBand> bands = new ArrayList<>();

    @OneToMany(mappedBy = "gradingScheme", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<GradingSchemeClassAssignment> classAssignments = new ArrayList<>();

    @PrePersist
    @PreUpdate
    private void syncLegacyActiveFlag() {
        this.active = this.status == GradingSchemeStatus.ACTIVE;
    }
}
