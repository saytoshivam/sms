package com.myhaimi.sms.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Data
@Entity
@Table(name = "fee_invoices")
public class FeeInvoice {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "school_id", nullable = false)
    private School school;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amountDue;

    @Column(nullable = false)
    private LocalDate dueDate;

    @Column(nullable = false, length = 16)
    private String status; // DUE, PARTIAL, PAID, VOID

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;
}

