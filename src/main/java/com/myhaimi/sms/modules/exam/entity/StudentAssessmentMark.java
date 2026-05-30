package com.myhaimi.sms.modules.exam.entity;

import com.myhaimi.sms.entity.School;
import com.myhaimi.sms.entity.Student;
import com.myhaimi.sms.modules.exam.entity.enums.MarkStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Stores one student's marks for a single {@link AssessmentInstance}.
 * One row per student per assessment instance (enforced by unique constraint).
 */
@Getter
@Setter
@Entity
@Table(
        name = "student_assessment_marks",
        indexes = {
                @Index(name = "idx_sam_instance", columnList = "assessment_instance_id"),
                @Index(name = "idx_sam_student",  columnList = "student_id"),
                @Index(name = "idx_sam_school",   columnList = "school_id"),
                @Index(name = "idx_sam_status",   columnList = "status")
        },
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_sam_instance_student",
                        columnNames = {"assessment_instance_id", "student_id"})
        }
)
public class StudentAssessmentMark {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "school_id", nullable = false)
    private School school;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "assessment_instance_id", nullable = false)
    private AssessmentInstance assessmentInstance;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    /**
     * Marks scored. Null when {@code absent=true} and school rule requires null.
     * Must be {@code <= assessmentInstance.maxMarks} when not null.
     */
    @Column(name = "marks_obtained", precision = 6, scale = 2)
    private BigDecimal marksObtained;

    @Column(nullable = false)
    private boolean absent = false;

    @Column(name = "absent_reason", length = 256)
    private String absentReason;

    @Column(length = 512)
    private String remarks;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private MarkStatus status = MarkStatus.DRAFT;

    /** Email / username of the user who entered the marks. */
    @Column(name = "entered_by", length = 256)
    private String enteredBy;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    @Column(name = "locked_at")
    private Instant lockedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}

