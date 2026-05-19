package com.myhaimi.sms.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Allocation of a {@link FeePayment} amount to a specific {@link StudentFeeDemand}.
 *
 * <p>One payment can have multiple allocations (one per demand).
 * The sum of all allocation amounts must equal the payment amount.</p>
 */
@Getter
@Setter
@Entity
@Table(
        name = "fee_payment_allocations",
        uniqueConstraints = @UniqueConstraint(columnNames = {"payment_id", "student_fee_demand_id"})
)
public class FeePaymentAllocation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "payment_id", nullable = false)
    private FeePayment payment;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_fee_demand_id", nullable = false)
    private StudentFeeDemand studentFeeDemand;

    @Column(name = "allocated_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal allocatedAmount;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}

