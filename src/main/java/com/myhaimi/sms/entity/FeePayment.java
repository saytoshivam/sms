package com.myhaimi.sms.entity;

import com.myhaimi.sms.entity.enums.PaymentMode;
import com.myhaimi.sms.entity.enums.PaymentStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * Offline/manual fee payment collected by an accountant or admin against
 * one or more {@link StudentFeeDemand} records.
 *
 * <p>Allocations are stored separately in {@link FeePaymentAllocation}.</p>
 */
@Getter
@Setter
@Entity
@Table(
        name = "fee_payments",
        uniqueConstraints = @UniqueConstraint(columnNames = {"school_id", "receipt_no"})
)
public class FeePayment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "school_id", nullable = false)
    private School school;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    /** School-scoped unique receipt number, e.g. RCPT-2026-000001. */
    @Column(name = "receipt_no", nullable = false, length = 64)
    private String receiptNo;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_mode", nullable = false, length = 32)
    private PaymentMode paymentMode;

    @Column(name = "payment_date", nullable = false)
    private LocalDate paymentDate;

    @Column(name = "reference_no", length = 128)
    private String referenceNo;

    @Column(length = 512)
    private String notes;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private PaymentStatus status = PaymentStatus.SUCCESS;

    /** User ID of the staff member who collected the payment. */
    @Column(name = "collected_by_user_id")
    private Integer collectedByUserId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
