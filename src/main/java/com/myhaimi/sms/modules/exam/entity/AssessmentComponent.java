package com.myhaimi.sms.modules.exam.entity;

import com.myhaimi.sms.modules.exam.entity.enums.CalculationRule;
import com.myhaimi.sms.modules.exam.entity.enums.ComponentType;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * A single component (e.g. CA, Mid-Term, Attendance) within an {@link AssessmentScheme}.
 */
@Getter
@Setter
@Entity
@Table(name = "assessment_components", indexes = {
        @Index(name = "idx_ac_scheme", columnList = "scheme_id")
})
public class AssessmentComponent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "scheme_id", nullable = false)
    private AssessmentScheme scheme;

    @Column(nullable = false, length = 128)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "component_type", nullable = false, length = 32)
    private ComponentType componentType;

    /** Percentage share in the final result (must be > 0). Total of all components must equal 100 before publish. */
    @Column(name = "weightage_percent", nullable = false, precision = 5, scale = 2)
    private BigDecimal weightagePercent;

    /** Maximum marks for this component; may be null for ATTENDANCE_PERCENTAGE rule. */
    @Column(name = "max_marks", precision = 6, scale = 2)
    private BigDecimal maxMarks;

    @Enumerated(EnumType.STRING)
    @Column(name = "calculation_rule", nullable = false, length = 32)
    private CalculationRule calculationRule;

    /** Total number of assessments conducted (required for BEST_N_OF_M / SUM / AVERAGE). */
    @Column(name = "total_assessments")
    private Integer totalAssessments;

    /** How many of the top assessments to count (required when rule = BEST_N_OF_M; must be <= totalAssessments). */
    @Column(name = "best_of_count")
    private Integer bestOfCount;

    /** Display/processing order within the scheme; must be unique per scheme. */
    @Column(nullable = false)
    private Integer sequence;

    @Column(nullable = false)
    private boolean mandatory = true;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
