package com.myhaimi.sms.entity;

import com.myhaimi.sms.entity.enums.FeePlanStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

/**
 * Fee plan (template) for an academic year.
 *
 * <p>Only {@link FeePlanStatus#PUBLISHED} plans can generate {@link StudentFeeDemand} records.
 * Once published, plan items cannot be directly edited — amendments must go through
 * a revision process (archive + new plan). This prevents silent mutation of
 * already-generated student demands.</p>
 */
@Getter
@Setter
@Entity
@Table(name = "fee_plans")
public class FeePlan {

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

    @Column(length = 512)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private FeePlanStatus status = FeePlanStatus.DRAFT;

    /** Timestamp when this plan was published (set on first PUBLISHED transition). */
    @Column(name = "published_at")
    private Instant publishedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
