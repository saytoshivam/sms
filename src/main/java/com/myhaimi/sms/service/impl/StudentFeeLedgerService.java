package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.fee.StudentFeeLedgerDTO;
import com.myhaimi.sms.DTO.fee.StudentFeeLedgerEntryDTO;
import com.myhaimi.sms.entity.FeePayment;
import com.myhaimi.sms.entity.FeePaymentAllocation;
import com.myhaimi.sms.entity.Student;
import com.myhaimi.sms.entity.StudentFeeDemand;
import com.myhaimi.sms.entity.enums.LedgerEntryType;
import com.myhaimi.sms.entity.enums.PaymentStatus;
import com.myhaimi.sms.repository.FeePaymentAllocationRepository;
import com.myhaimi.sms.repository.FeePaymentRepo;
import com.myhaimi.sms.repository.StudentFeeDemandRepository;
import com.myhaimi.sms.repository.StudentRepo;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Generates a computed fee ledger for a student.
 *
 * <p>The ledger is built purely from existing {@link StudentFeeDemand} and
 * {@link FeePayment} / {@link FeePaymentAllocation} records.  It is NOT stored
 * — future concession/fine modules can hook in by contributing entries to the
 * same sorted list.</p>
 *
 * <h3>Sorting strategy</h3>
 * <ol>
 *   <li>Primary: entry date (demand dueDate / payment paymentDate) ascending.</li>
 *   <li>Secondary: {@code createdAt} of the source record ascending (tie-break within
 *       same calendar day).</li>
 *   <li>Tertiary: source entity id ascending (deterministic ordering).</li>
 * </ol>
 *
 * <h3>Balance direction</h3>
 * <ul>
 *   <li>DEMAND  — debit (balance increases)</li>
 *   <li>PAYMENT — credit (balance decreases)</li>
 *   <li>PAYMENT_CANCELLED — debit (reversal: balance increases back)</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StudentFeeLedgerService {

    private final StudentRepo                   studentRepo;
    private final StudentFeeDemandRepository    demandRepo;
    private final FeePaymentRepo                paymentRepo;
    private final FeePaymentAllocationRepository allocationRepo;

    // ─── public API ───────────────────────────────────────────────────────────

    /**
     * Build and return the complete fee ledger for a student in the current
     * school (tenant) context.
     *
     * @param studentId the student's primary key
     * @return fully computed {@link StudentFeeLedgerDTO}
     * @throws IllegalArgumentException if the student is not found in this school
     */
    @Transactional(readOnly = true)
    public StudentFeeLedgerDTO getLedger(Integer studentId) {
        Integer schoolId = requireSchoolId();

        Student student = studentRepo.findByIdAndSchool_Id(studentId, schoolId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Student not found: " + studentId));

        String studentName = buildName(student);

        // ── collect raw entries ────────────────────────────────────────────────

        List<RawEntry> rawEntries = new ArrayList<>();

        // 1. Demands → DEBIT lines
        List<StudentFeeDemand> demands =
                demandRepo.findBySchool_IdAndStudent_Id(schoolId, studentId);
        for (StudentFeeDemand d : demands) {
            rawEntries.add(new RawEntry(
                    d.getDueDate(),
                    d.getCreatedAt(),
                    d.getId(),
                    LedgerEntryType.DEMAND,
                    d.getDemandNo(),
                    buildDemandDescription(d),
                    d.getPayableAmount(),
                    BigDecimal.ZERO,
                    "StudentFeeDemand",
                    d.getId()
            ));
        }

        // 2. Payments → CREDIT or PAYMENT_CANCELLED lines
        List<FeePayment> payments =
                paymentRepo.findBySchool_IdAndStudent_IdOrderByPaymentDateDesc(schoolId, studentId);
        for (FeePayment p : payments) {
            if (p.getStatus() == PaymentStatus.SUCCESS) {
                // Each allocation becomes its own credit line for demand-level visibility
                List<FeePaymentAllocation> allocations = allocationRepo.findByPayment_Id(p.getId());
                if (allocations.isEmpty()) {
                    // Fallback: single payment-level credit line
                    rawEntries.add(new RawEntry(
                            p.getPaymentDate(),
                            p.getCreatedAt(),
                            p.getId(),
                            LedgerEntryType.PAYMENT,
                            p.getReceiptNo(),
                            buildPaymentDescription(p),
                            BigDecimal.ZERO,
                            p.getAmount(),
                            "FeePayment",
                            p.getId()
                    ));
                } else {
                    for (FeePaymentAllocation alloc : allocations) {
                        StudentFeeDemand demand = alloc.getStudentFeeDemand();
                        String desc = String.format("Payment (%s) against %s",
                                p.getReceiptNo(), demand.getDemandNo());
                        rawEntries.add(new RawEntry(
                                p.getPaymentDate(),
                                alloc.getCreatedAt(),
                                alloc.getId(),
                                LedgerEntryType.PAYMENT,
                                p.getReceiptNo(),
                                desc,
                                BigDecimal.ZERO,
                                alloc.getAllocatedAmount(),
                                "FeePaymentAllocation",
                                alloc.getId()
                        ));
                    }
                }
            } else if (p.getStatus() == PaymentStatus.CANCELLED) {
                // Cancelled payment reversal — debit line to restore balance
                rawEntries.add(new RawEntry(
                        p.getUpdatedAt() != null
                                ? p.getUpdatedAt().atZone(ZoneOffset.UTC).toLocalDate()
                                : p.getPaymentDate(),
                        p.getUpdatedAt() != null ? p.getUpdatedAt() : p.getCreatedAt(),
                        p.getId(),
                        LedgerEntryType.PAYMENT_CANCELLED,
                        p.getReceiptNo(),
                        "Cancelled: " + p.getReceiptNo(),
                        p.getAmount(),
                        BigDecimal.ZERO,
                        "FeePayment",
                        p.getId()
                ));
            }
        }

        // ── sort ──────────────────────────────────────────────────────────────
        rawEntries.sort(
                Comparator.comparing(RawEntry::date)
                        .thenComparing(e -> e.sortInstant() != null
                                ? e.sortInstant() : Instant.EPOCH)
                        .thenComparingLong(RawEntry::sortId)
        );

        // ── compute running balance and totals ────────────────────────────────
        BigDecimal running    = BigDecimal.ZERO;
        BigDecimal totalDebit = BigDecimal.ZERO;
        BigDecimal totalCredit= BigDecimal.ZERO;

        List<StudentFeeLedgerEntryDTO> entries = new ArrayList<>(rawEntries.size());

        for (RawEntry re : rawEntries) {
            running     = running.add(re.debit()).subtract(re.credit());
            totalDebit  = totalDebit.add(re.debit());
            totalCredit = totalCredit.add(re.credit());

            entries.add(StudentFeeLedgerEntryDTO.builder()
                    .date(re.date())
                    .type(re.type())
                    .referenceNo(re.referenceNo())
                    .description(re.description())
                    .debit(re.debit().compareTo(BigDecimal.ZERO) == 0  ? null : re.debit())
                    .credit(re.credit().compareTo(BigDecimal.ZERO) == 0 ? null : re.credit())
                    .balanceAfter(running)
                    .sourceType(re.sourceType())
                    .sourceId(re.sourceId())
                    .build());
        }

        return StudentFeeLedgerDTO.builder()
                .studentId(studentId)
                .studentName(studentName)
                .totalDebit(totalDebit)
                .totalCredit(totalCredit)
                .balance(totalDebit.subtract(totalCredit))
                .entries(entries)
                .build();
    }

    // ─── private helpers ──────────────────────────────────────────────────────

    private Integer requireSchoolId() {
        Integer id = TenantContext.getTenantId();
        if (id == null) throw new IllegalStateException("Missing school context");
        return id;
    }

    private String buildName(Student s) {
        String name = s.getFirstName();
        if (s.getMiddleName() != null && !s.getMiddleName().isBlank()) {
            name += " " + s.getMiddleName();
        }
        if (s.getLastName() != null && !s.getLastName().isBlank()) {
            name += " " + s.getLastName();
        }
        return name.trim();
    }

    private String buildDemandDescription(StudentFeeDemand d) {
        StringBuilder sb = new StringBuilder();
        if (d.getFeeHead() != null) sb.append(d.getFeeHead().getName());
        if (d.getInstallment() != null) {
            sb.append(" — ").append(d.getInstallment().getName());
        }
        if (d.getAcademicYear() != null) {
            sb.append(" (").append(d.getAcademicYear().getLabel()).append(")");
        }
        return sb.toString();
    }

    private String buildPaymentDescription(FeePayment p) {
        return String.format("%s via %s%s",
                p.getReceiptNo(),
                p.getPaymentMode().name(),
                p.getReferenceNo() != null ? " [" + p.getReferenceNo() + "]" : "");
    }

    // ─── internal sort carrier ────────────────────────────────────────────────

    /**
     * Internal carrier for collecting and sorting raw ledger lines before
     * building the final DTO.
     */
    private record RawEntry(
            LocalDate date,
            Instant   sortInstant,
            Long      sortId,
            LedgerEntryType type,
            String referenceNo,
            String description,
            BigDecimal debit,
            BigDecimal credit,
            String sourceType,
            Long   sourceId
    ) {}
}

