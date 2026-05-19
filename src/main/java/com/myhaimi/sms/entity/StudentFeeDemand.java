package com.myhaimi.sms.entity;

import com.myhaimi.sms.entity.enums.StudentFeeDemandStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * The actual payable record generated for a student.
 *
 * <p><strong>Immutability principle:</strong> Once generated, the amounts on a demand
 * are a snapshot from the fee plan at generation time. Subsequent changes to the
 * {@link FeePlan} do NOT silently change existing demands. Adjustments go through
 * concession/fine fields only.</p>
 *
 * <p>Financial invariants (enforced at application level):
 * <ul>
 *   <li>{@code payableAmount = originalAmount - concessionAmount + fineAmount}</li>
 *   <li>{@code balanceAmount = payableAmount - paidAmount}</li>
 * </ul>
 * </p>
 */
@Getter
@Setter
@Entity
@Table(
        name = "student_fee_demands",
        uniqueConstraints = @UniqueConstraint(columnNames = {"school_id", "demand_no"})
)
public class StudentFeeDemand {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "school_id", nullable = false)
    private School school;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "academic_year_id", nullable = false)
    private AcademicYear academicYear;

    /** The fee plan snapshot this demand was generated from. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "fee_plan_id", nullable = false)
    private FeePlan feePlan;

    /** Fee head snapshot copied at demand generation time. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "fee_head_id", nullable = false)
    private FeeHead feeHead;

    /** Plan item that triggered this demand (informational link). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "fee_plan_item_id")
    private FeePlanItem feePlanItem;

    /** Installment this demand maps to; null for ONE_TIME items. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "fee_installment_id")
    private FeeInstallment installment;

    /** School-scoped unique human-readable reference number (e.g. "GH-2526-000001"). */
    @Column(name = "demand_no", nullable = false, length = 64)
    private String demandNo;

    @Column(length = 512)
    private String description;

    /** Original amount as per fee plan at generation time — never modified after creation. */
    @Column(name = "original_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal originalAmount;

    /** Approved concession/discount applied to this demand. Default 0. */
    @Column(name = "concession_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal concessionAmount = BigDecimal.ZERO;

    /** Late-payment or other fine applied. Default 0. */
    @Column(name = "fine_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal fineAmount = BigDecimal.ZERO;

    /** Derived: originalAmount - concessionAmount + fineAmount. Stored for query performance. */
    @Column(name = "payable_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal payableAmount;

    /** Total confirmed payments received against this demand. Default 0. */
    @Column(name = "paid_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal paidAmount = BigDecimal.ZERO;

    /** Derived: payableAmount - paidAmount. Stored for query performance. */
    @Column(name = "balance_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal balanceAmount;

    @Column(name = "due_date", nullable = false)
    private LocalDate dueDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private StudentFeeDemandStatus status = StudentFeeDemandStatus.UNPAID;

    /** Timestamp when this demand record was generated/created. */
    @Column(name = "generated_at", nullable = false, updatable = false)
    private Instant generatedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    public void prePersist() {
        if (generatedAt == null) generatedAt = Instant.now();
        recalculate();
    }

    @PreUpdate
    public void preUpdate() {
        recalculate();
    }

    /** Recompute derived payable/balance from constituent parts. */
    public void recalculate() {
        if (originalAmount == null) return;
        BigDecimal concession = concessionAmount != null ? concessionAmount : BigDecimal.ZERO;
        BigDecimal fine = fineAmount != null ? fineAmount : BigDecimal.ZERO;
        BigDecimal paid = paidAmount != null ? paidAmount : BigDecimal.ZERO;
        payableAmount = originalAmount.subtract(concession).add(fine);
        balanceAmount = payableAmount.subtract(paid);
    }
}
