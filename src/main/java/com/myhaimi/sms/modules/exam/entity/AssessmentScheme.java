package com.myhaimi.sms.modules.exam.entity;

import com.myhaimi.sms.entity.AcademicYear;
import com.myhaimi.sms.entity.School;
import com.myhaimi.sms.modules.exam.entity.enums.AssessmentSchemeStatus;
import com.myhaimi.sms.modules.exam.entity.enums.ExamApplicableScopeType;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Configurable assessment scheme (e.g. "CBSE Term 2025-26").
 * A DRAFT scheme is editable; once PUBLISHED it is read-only and can only be cloned.
 */
@Getter
@Setter
@Entity
@Table(name = "assessment_schemes", indexes = {
        @Index(name = "idx_as_school", columnList = "school_id"),
        @Index(name = "idx_as_academic_year", columnList = "academic_year_id"),
        @Index(name = "idx_as_status", columnList = "status"),
        @Index(name = "idx_as_scope", columnList = "applicable_scope_type, applicable_scope_id")
})
public class AssessmentScheme {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "school_id", nullable = false)
    private School school;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "academic_year_id", nullable = false)
    private AcademicYear academicYear;

    @Column(nullable = false, length = 128)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "applicable_scope_type", nullable = false, length = 32)
    private ExamApplicableScopeType applicableScopeType;

    /** ID of the entity identified by {@code applicableScopeType} (class, section, subject). Null for SCHOOL scope. */
    @Column(name = "applicable_scope_id")
    private Integer applicableScopeId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private AssessmentSchemeStatus status = AssessmentSchemeStatus.DRAFT;

    @Column(name = "version_no", nullable = false)
    private Integer versionNo = 1;

    @Column(name = "published_at")
    private Instant publishedAt;

    @Column(name = "archived_at")
    private Instant archivedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @OneToMany(mappedBy = "scheme", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sequence ASC")
    private List<AssessmentComponent> components = new ArrayList<>();
}
