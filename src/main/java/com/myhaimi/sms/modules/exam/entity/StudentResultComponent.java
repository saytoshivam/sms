package com.myhaimi.sms.modules.exam.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * Per-component breakdown of a {@link StudentResult}.
 */
@Getter
@Setter
@Entity
@Table(
        name = "student_result_components",
        indexes = {
                @Index(name = "idx_src_result", columnList = "student_result_id"),
                @Index(name = "idx_src_component", columnList = "assessment_component_id")
        }
)
public class StudentResultComponent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_result_id", nullable = false)
    private StudentResult studentResult;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "assessment_component_id", nullable = false)
    private AssessmentComponent assessmentComponent;

    /** Raw marks obtained for this component (aggregated per rule). */
    @Column(name = "raw_score", precision = 8, scale = 4)
    private BigDecimal rawScore;

    /** Maximum possible raw marks for this component. */
    @Column(name = "raw_max", precision = 8, scale = 4)
    private BigDecimal rawMax;

    /** Weighted score = (rawScore / rawMax) * weightagePercent. */
    @Column(name = "weighted_score", precision = 7, scale = 4)
    private BigDecimal weightedScore;

    /** Snapshot of the component's weightage at the time of calculation. */
    @Column(name = "weightage_percent", precision = 5, scale = 2)
    private BigDecimal weightagePercent;

    /** JSON blob capturing per-assessment breakdown (instance ids, marks, selection logic). */
    @Column(name = "calculation_details_json", columnDefinition = "TEXT")
    private String calculationDetailsJson;
}

