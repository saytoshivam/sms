package com.myhaimi.sms.modules.exam.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * A single grade band within a {@link GradingScheme} (e.g. A1 = 91–100).
 */
@Getter
@Setter
@Entity
@Table(name = "grading_bands", indexes = {
        @Index(name = "idx_gb_scheme", columnList = "grading_scheme_id")
})
public class GradingBand {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "grading_scheme_id", nullable = false)
    private GradingScheme gradingScheme;

    @Column(nullable = false, length = 16)
    private String grade;

    @Column(name = "min_percent", nullable = false, precision = 5, scale = 2)
    private BigDecimal minPercent;

    @Column(name = "max_percent", nullable = false, precision = 5, scale = 2)
    private BigDecimal maxPercent;

    /** Optional GPA/grade point (e.g. 10.0, 9.0 …). */
    @Column(name = "grade_point", precision = 4, scale = 2)
    private BigDecimal gradePoint;

    @Column(length = 128)
    private String remarks;

    /** Display order within the scheme. */
    @Column(nullable = false)
    private Integer sequence;
}
