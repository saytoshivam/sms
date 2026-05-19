package com.myhaimi.sms.entity;

import com.myhaimi.sms.entity.enums.ApplicableScopeType;
import com.myhaimi.sms.entity.enums.FeeFrequency;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * One fee-head entry within a fee plan, optionally scoped to a class/section/student.
 *
 * <p>{@link #applicableScopeId} is a polymorphic foreign key interpreted according to
 * {@link #applicableScopeType}:
 * <ul>
 *   <li>SCHOOL  — the school id (all students)</li>
 *   <li>CLASS   — a ClassGroup id representing a whole grade</li>
 *   <li>SECTION — a ClassGroup id representing a specific section</li>
 *   <li>STUDENT — a Student id</li>
 * </ul>
 * </p>
 */
@Getter
@Setter
@Entity
@Table(name = "fee_plan_items")
public class FeePlanItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "fee_plan_id", nullable = false)
    private FeePlan feePlan;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "fee_head_id", nullable = false)
    private FeeHead feeHead;

    @Enumerated(EnumType.STRING)
    @Column(name = "applicable_scope_type", nullable = false, length = 16)
    private ApplicableScopeType applicableScopeType;

    /** Polymorphic id — resolves to school/class_group/student based on scope type. */
    @Column(name = "applicable_scope_id", nullable = false)
    private Integer applicableScopeId;

    /** Total charge amount for this item (must be > 0). */
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private FeeFrequency frequency;

    /** When false, students can opt-out (if FeeHead.optional is also true). */
    @Column(nullable = false)
    private boolean mandatory = true;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
