package com.myhaimi.sms.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;

/**
 * Legacy invoice-based fee payment (pre-demand-collection era).
 * Preserved for backward-compatibility; uses the {@code legacy_fee_payments} table.
 */
@Data
@Entity
@Table(name = "legacy_fee_payments")
public class LegacyFeePayment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "invoice_id", nullable = false)
    private FeeInvoice invoice;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false)
    private LocalDateTime paidAt;

    @Column(length = 32)
    private String method; // CASH, UPI, CARD, BANK, CHEQUE

    @Column(length = 128)
    private String reference;

    /** Payment microservice order id (e.g. pay_abc). */
    @Column(name = "gateway_order_id", length = 128)
    private String gatewayOrderId;

    /** PENDING | SUCCEEDED | FAILED — online gateway lifecycle. */
    @Column(name = "gateway_status", length = 32)
    private String gatewayStatus;

    /** Client-supplied idempotency key for create-intent (optional). */
    @Column(name = "idempotency_key", length = 128, unique = true)
    private String idempotencyKey;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;
}

