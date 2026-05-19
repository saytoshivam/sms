package com.myhaimi.sms.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * Represents a single due-date installment for a {@link FeePlanItem}.
 *
 * <p>The sum of all installment amounts for a plan item should equal
 * {@link FeePlanItem#getAmount()} (enforced at publish time).</p>
 */
@Getter
@Setter
@Entity
@Table(name = "fee_installments")
public class FeeInstallment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "fee_plan_item_id", nullable = false)
    private FeePlanItem feePlanItem;

    /** Human label, e.g. "April Instalment", "Q1 2025-26". */
    @Column(nullable = false, length = 128)
    private String name;

    @Column(name = "due_date", nullable = false)
    private LocalDate dueDate;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    /** 1-based ordering within the plan item's installment schedule. */
    @Column(nullable = false)
    private int sequence;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
