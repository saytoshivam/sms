package com.myhaimi.sms.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * Receipt document generated for a {@link FeePayment}.
 *
 * <p>One receipt per payment. Receipt can be cancelled (not deleted) when the
 * payment is cancelled.</p>
 */
@Getter
@Setter
@Entity
@Table(name = "fee_receipts")
public class FeeReceipt {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "payment_id", nullable = false, unique = true)
    private FeePayment payment;

    @Column(name = "receipt_no", nullable = false, length = 64)
    private String receiptNo;

    @Column(name = "issued_at", nullable = false)
    private Instant issuedAt;

    /** URL to generated PDF receipt (nullable — generated asynchronously or on demand). */
    @Column(name = "pdf_url", length = 512)
    private String pdfUrl;

    /** Set when the payment is cancelled. */
    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    @Column(name = "cancel_reason", length = 512)
    private String cancelReason;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}

