package com.myhaimi.sms.modules.exam.entity;

import com.myhaimi.sms.entity.AcademicYear;
import com.myhaimi.sms.entity.ClassGroup;
import com.myhaimi.sms.entity.School;
import com.myhaimi.sms.entity.Student;
import com.myhaimi.sms.entity.Subject;
import com.myhaimi.sms.modules.exam.entity.enums.ResultStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Computed/generated result for a single student in a subject under a given assessment scheme.
 */
@Getter
@Setter
@Entity
@Table(
        name = "student_results",
        indexes = {
                @Index(name = "idx_sr_school", columnList = "school_id"),
                @Index(name = "idx_sr_student", columnList = "student_id"),
                @Index(name = "idx_sr_class_subject", columnList = "class_group_id, subject_id"),
                @Index(name = "idx_sr_scheme", columnList = "scheme_id"),
                @Index(name = "idx_sr_status", columnList = "status")
        },
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_sr_student_subject_scheme",
                        columnNames = {"student_id", "subject_id", "scheme_id"}
                )
        }
)
public class StudentResult {

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
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "class_group_id", nullable = false)
    private ClassGroup classGroup;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "scheme_id", nullable = false)
    private AssessmentScheme scheme;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "subject_id", nullable = false)
    private Subject subject;

    /** Sum of all weighted component scores (0–100 when total weightage = 100). */
    @Column(name = "total_weighted_score", precision = 7, scale = 4)
    private BigDecimal totalWeightedScore;

    /** Percentage (same as totalWeightedScore when total weightage == 100). */
    @Column(precision = 6, scale = 2)
    private BigDecimal percentage;

    /** Grade label resolved from the active grading scheme (e.g. "A1", "B2"). */
    @Column(length = 16)
    private String grade;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private ResultStatus status = ResultStatus.GENERATED;

    @Column(name = "generated_at")
    private Instant generatedAt;

    @Column(name = "published_at")
    private Instant publishedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @OneToMany(mappedBy = "studentResult", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<StudentResultComponent> components = new ArrayList<>();
}

