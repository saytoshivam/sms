package com.myhaimi.sms.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * Academic score used for analytics / report cards (demo & production).
 */
@Data
@Entity
@Table(
        name = "student_marks",
        uniqueConstraints = @UniqueConstraint(columnNames = {"school_id", "student_id", "subject_code", "assessment_key"}))
public class StudentMark {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "school_id", nullable = false)
    private School school;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    @Column(name = "subject_code", nullable = false, length = 32)
    private String subjectCode;

    /** Stable key for idempotent seeding (e.g. UNIT1_MATH). */
    @Column(name = "assessment_key", nullable = false, length = 64)
    private String assessmentKey;

    @Column(name = "assessment_title", nullable = false, length = 128)
    private String assessmentTitle;

    @Column(name = "max_score", nullable = false, precision = 6, scale = 2)
    private BigDecimal maxScore;

    @Column(name = "score_obtained", nullable = false, precision = 6, scale = 2)
    private BigDecimal scoreObtained;

    @Column(name = "assessed_on", nullable = false)
    private LocalDate assessedOn;

    @Column(name = "term_name", length = 64)
    private String termName;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;
}
