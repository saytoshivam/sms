package com.myhaimi.sms.modules.exam.entity;

import com.myhaimi.sms.entity.AcademicYear;
import com.myhaimi.sms.entity.School;
import com.myhaimi.sms.modules.exam.entity.enums.AssessmentSchemeStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Reusable assessment pattern (components and weightages). Applicability is held
 * in {@link AssessmentSchemeAssignment}; do not duplicate schemes per target.
 */
@Getter
@Setter
@Entity
@Table(name = "assessment_schemes", indexes = {
        @Index(name = "idx_as_school", columnList = "school_id"),
        @Index(name = "idx_as_academic_year", columnList = "academic_year_id"),
        @Index(name = "idx_as_status", columnList = "status")
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

    @OneToMany(mappedBy = "scheme", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<AssessmentSchemeAssignment> assignments = new ArrayList<>();
}
