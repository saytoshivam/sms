package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.fee.*;
import com.myhaimi.sms.entity.*;
import com.myhaimi.sms.entity.enums.PaymentMode;
import com.myhaimi.sms.entity.enums.PaymentStatus;
import com.myhaimi.sms.entity.enums.SequenceType;
import com.myhaimi.sms.entity.enums.StudentFeeDemandStatus;
import com.myhaimi.sms.repository.*;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Handles offline/manual fee payment collection against student fee demands.
 *
 * <p>Business rules enforced:
 * <ul>
 *   <li>Allocations list must not be empty.</li>
 *   <li>No duplicate demand IDs in one request.</li>
 *   <li>Demand must be UNPAID or PARTIAL — rejects PAID, WAIVED, CANCELLED.</li>
 *   <li>Demand balance must be > 0.</li>
 *   <li>Allocated amount per demand must be positive and ≤ demand balance.</li>
 *   <li>Payment amount = sum of allocations (derived, not a request field).</li>
 *   <li>UPI / BANK_TRANSFER / CHEQUE / CARD require a non-blank referenceNo.</li>
 *   <li>Receipt number is school-scoped and sequence-safe (no COUNT+1).</li>
 *   <li>Cancellation reverses allocations, cannot make paidAmount negative, preserves records.</li>
 * </ul>
 * </p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FeePaymentService {

    /** Payment modes that require a non-blank reference number. */
    private static final Set<PaymentMode> REFERENCE_REQUIRED_MODES = Set.of(
            PaymentMode.UPI, PaymentMode.BANK_TRANSFER, PaymentMode.CHEQUE, PaymentMode.CARD);

    /** Demand statuses that block receiving payment. */
    private static final Set<StudentFeeDemandStatus> NON_PAYABLE_STATUSES = Set.of(
            StudentFeeDemandStatus.PAID, StudentFeeDemandStatus.WAIVED, StudentFeeDemandStatus.CANCELLED);

    private final FeePaymentRepo paymentRepo;
    private final FeePaymentAllocationRepository allocationRepo;
    private final FeeReceiptRepository receiptRepo;
    private final StudentFeeDemandRepository demandRepo;
    private final StudentRepo studentRepo;
    private final SchoolRepo schoolRepo;
    private final UserRepo userRepo;
    private final SchoolSequenceService sequenceService;

    // ─── helpers ──────────────────────────────────────────────────────────────

    private Integer requireSchoolId() {
        Integer id = TenantContext.getTenantId();
        if (id == null) throw new IllegalStateException("Missing school context");
        return id;
    }

    private School requireSchool(Integer schoolId) {
        return schoolRepo.findById(schoolId)
                .orElseThrow(() -> new IllegalStateException("School not found: " + schoolId));
    }

    private Integer currentUserId() {
        try {
            String email = SecurityContextHolder.getContext().getAuthentication().getName();
            return userRepo.findFirstByEmailIgnoreCase(email).map(u -> (int) u.getId()).orElse(null);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Builds a collision-safe receipt number using the school-scoped sequence service.
     * Format: RCPT-{year}-{seq:06d}
     */
    private String buildReceiptNo(Integer schoolId, LocalDate paymentDate) {
        long seq = sequenceService.nextValue(schoolId, SequenceType.FEE_RECEIPT);
        int year = paymentDate.getYear();
        return String.format("RCPT-%d-%06d", year, seq);
    }

    private void updateDemandStatus(StudentFeeDemand demand) {
        BigDecimal paid    = demand.getPaidAmount()    != null ? demand.getPaidAmount()    : BigDecimal.ZERO;
        BigDecimal payable = demand.getPayableAmount() != null ? demand.getPayableAmount() : BigDecimal.ZERO;
        if (paid.compareTo(BigDecimal.ZERO) == 0) {
            demand.setStatus(StudentFeeDemandStatus.UNPAID);
        } else if (paid.compareTo(payable) >= 0) {
            demand.setStatus(StudentFeeDemandStatus.PAID);
        } else {
            demand.setStatus(StudentFeeDemandStatus.PARTIAL);
        }
    }

    // ─── collect payment ──────────────────────────────────────────────────────

    @Transactional
    public FeePaymentDTO collectPayment(FeePaymentCreateRequestDTO req) {
        Integer schoolId = requireSchoolId();
        School  school   = requireSchool(schoolId);

        Student student = studentRepo.findByIdAndSchool_Id(req.getStudentId(), schoolId)
                .orElseThrow(() -> new IllegalArgumentException("Student not found: " + req.getStudentId()));

        // ── 1. Allocations must not be empty ───────────────────────────────
        if (req.getAllocations() == null || req.getAllocations().isEmpty()) {
            throw new IllegalArgumentException("At least one demand allocation is required.");
        }

        // ── 2. No duplicate demand IDs ─────────────────────────────────────
        Set<Long> seenDemandIds = new HashSet<>();
        for (FeePaymentCreateRequestDTO.AllocationItemDTO alloc : req.getAllocations()) {
            if (!seenDemandIds.add(alloc.getDemandId())) {
                throw new IllegalArgumentException(
                        "Duplicate demand ID in allocations: " + alloc.getDemandId());
            }
        }

        // ── 3. Validate payment mode ───────────────────────────────────────
        PaymentMode mode;
        try {
            mode = PaymentMode.valueOf(req.getPaymentMode().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid paymentMode: " + req.getPaymentMode());
        }

        // ── 4. Reference required modes ────────────────────────────────────
        if (REFERENCE_REQUIRED_MODES.contains(mode)
                && (req.getReferenceNo() == null || req.getReferenceNo().isBlank())) {
            throw new IllegalArgumentException(
                    "referenceNo is required for payment mode " + mode.name());
        }

        // ── 5. Validate each allocation ────────────────────────────────────
        List<StudentFeeDemand> demands       = new ArrayList<>();
        BigDecimal             totalAllocated = BigDecimal.ZERO;

        for (FeePaymentCreateRequestDTO.AllocationItemDTO alloc : req.getAllocations()) {
            StudentFeeDemand demand = demandRepo.findByIdAndSchool_Id(alloc.getDemandId(), schoolId)
                    .orElseThrow(() -> new IllegalArgumentException("Demand not found: " + alloc.getDemandId()));

            // 5a. Demand must belong to the student
            if (!demand.getStudent().getId().equals(req.getStudentId())) {
                throw new IllegalArgumentException(
                        "Demand " + alloc.getDemandId() + " does not belong to student " + req.getStudentId());
            }

            // 5b. Reject non-payable statuses
            if (NON_PAYABLE_STATUSES.contains(demand.getStatus())) {
                throw new IllegalArgumentException(
                        "Demand " + demand.getDemandNo() + " is " + demand.getStatus()
                        + " and cannot receive payment.");
            }

            // 5c. Balance must be positive
            BigDecimal balance = demand.getBalanceAmount() != null ? demand.getBalanceAmount() : BigDecimal.ZERO;
            if (balance.compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalArgumentException(
                        "Demand " + demand.getDemandNo() + " has no remaining balance.");
            }

            // 5d. Allocation amount must be positive and ≤ balance
            if (alloc.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalArgumentException(
                        "Allocated amount must be positive for demand " + demand.getDemandNo());
            }
            if (alloc.getAmount().compareTo(balance) > 0) {
                throw new IllegalArgumentException(
                        "Allocated amount " + alloc.getAmount() + " exceeds balance " + balance
                        + " for demand " + demand.getDemandNo());
            }

            demands.add(demand);
            totalAllocated = totalAllocated.add(alloc.getAmount());
        }

        // Payment amount is derived from allocations (not a separate request field).
        BigDecimal paymentAmount = totalAllocated;

        // ── 6. Build and save payment ──────────────────────────────────────
        FeePayment payment = new FeePayment();
        payment.setSchool(school);
        payment.setStudent(student);
        payment.setAmount(paymentAmount);
        payment.setPaymentMode(mode);
        payment.setPaymentDate(req.getPaymentDate());
        payment.setReferenceNo(req.getReferenceNo());
        payment.setNotes(req.getNotes());
        payment.setStatus(PaymentStatus.SUCCESS);
        payment.setCollectedByUserId(currentUserId());
        payment.setReceiptNo(buildReceiptNo(schoolId, req.getPaymentDate()));
        payment = paymentRepo.save(payment);

        // ── 7. Create allocations and update demands ───────────────────────
        List<FeePaymentAllocation> savedAllocations = new ArrayList<>();
        for (int i = 0; i < req.getAllocations().size(); i++) {
            FeePaymentCreateRequestDTO.AllocationItemDTO allocReq = req.getAllocations().get(i);
            StudentFeeDemand demand = demands.get(i);

            FeePaymentAllocation allocation = new FeePaymentAllocation();
            allocation.setPayment(payment);
            allocation.setStudentFeeDemand(demand);
            allocation.setAllocatedAmount(allocReq.getAmount());
            savedAllocations.add(allocationRepo.save(allocation));

            BigDecimal newPaid = demand.getPaidAmount().add(allocReq.getAmount());
            demand.setPaidAmount(newPaid);
            demand.recalculate();
            updateDemandStatus(demand);
            demandRepo.save(demand);
        }

        // ── 8. Create receipt ──────────────────────────────────────────────
        FeeReceipt receipt = new FeeReceipt();
        receipt.setPayment(payment);
        receipt.setReceiptNo(payment.getReceiptNo());
        receipt.setIssuedAt(Instant.now());
        receipt = receiptRepo.save(receipt);

        log.info("[AUDIT] fee_payment.collected schoolId={} paymentId={} receiptNo={} amount={} collectedBy={}",
                schoolId, payment.getId(), payment.getReceiptNo(), paymentAmount, payment.getCollectedByUserId());

        return toDTO(payment, savedAllocations, receipt);
    }

    // ─── list payments ────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<FeePaymentDTO> listPayments(Integer studentId, String paymentModeStr,
                                             LocalDate fromDate, LocalDate toDate, String statusStr) {
        Integer schoolId = requireSchoolId();

        PaymentMode paymentMode = null;
        if (paymentModeStr != null && !paymentModeStr.isBlank()) {
            try {
                paymentMode = PaymentMode.valueOf(paymentModeStr.toUpperCase());
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("Invalid paymentMode: " + paymentModeStr);
            }
        }

        PaymentStatus status = null;
        if (statusStr != null && !statusStr.isBlank()) {
            try {
                status = PaymentStatus.valueOf(statusStr.toUpperCase());
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("Invalid status: " + statusStr);
            }
        }

        List<FeePayment> payments = paymentRepo.findFiltered(schoolId, studentId, paymentMode, fromDate, toDate, status);
        return payments.stream().map(this::toDTOSummary).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<FeePaymentDTO> listPaymentsForStudent(Integer studentId) {
        Integer schoolId = requireSchoolId();
        studentRepo.findByIdAndSchool_Id(studentId, schoolId)
                .orElseThrow(() -> new IllegalArgumentException("Student not found: " + studentId));
        List<FeePayment> payments = paymentRepo.findBySchool_IdAndStudent_IdOrderByPaymentDateDesc(schoolId, studentId);
        return payments.stream().map(this::toDTOWithDetails).collect(Collectors.toList());
    }

    /**
     * Returns full DTO for a single payment (with allocations and receipt).
     * Used by the PDF download endpoint.
     */
    @Transactional(readOnly = true)
    public FeePaymentDTO getPaymentWithDetails(Long paymentId) {
        Integer schoolId = requireSchoolId();
        FeePayment payment = paymentRepo.findByIdAndSchool_Id(paymentId, schoolId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Payment not found or access denied: " + paymentId));
        return toDTOWithDetails(payment);
    }

    // ─── cancel payment ───────────────────────────────────────────────────────

    /**
     * Cancels a payment.
     *
     * <ul>
     *   <li>Requires a non-blank cancel reason.</li>
     *   <li>Rejects already-cancelled payments.</li>
     *   <li>Reverses all demand allocations (paidAmount never goes below 0).</li>
     *   <li>Recalculates demand statuses.</li>
     *   <li>Marks the receipt as cancelled.</li>
     *   <li>Records are preserved — never deleted.</li>
     * </ul>
     */
    @Transactional
    public FeePaymentDTO cancelPayment(Long paymentId, String cancelReason) {
        Integer schoolId = requireSchoolId();

        FeePayment payment = paymentRepo.findByIdAndSchool_Id(paymentId, schoolId)
                .orElseThrow(() -> new IllegalArgumentException("Payment not found: " + paymentId));

        if (payment.getStatus() == PaymentStatus.CANCELLED) {
            throw new IllegalStateException("Payment " + paymentId + " is already cancelled.");
        }
        if (cancelReason == null || cancelReason.isBlank()) {
            throw new IllegalArgumentException("cancelReason is required to cancel a payment.");
        }

        // Reverse allocations — paidAmount never goes below 0
        List<FeePaymentAllocation> allocations = allocationRepo.findByPayment_Id(paymentId);
        for (FeePaymentAllocation alloc : allocations) {
            StudentFeeDemand demand = alloc.getStudentFeeDemand();
            BigDecimal newPaid = demand.getPaidAmount().subtract(alloc.getAllocatedAmount());
            if (newPaid.compareTo(BigDecimal.ZERO) < 0) newPaid = BigDecimal.ZERO;
            demand.setPaidAmount(newPaid);
            demand.recalculate();
            updateDemandStatus(demand);
            demandRepo.save(demand);
        }

        // Mark payment CANCELLED (never delete)
        payment.setStatus(PaymentStatus.CANCELLED);
        payment = paymentRepo.save(payment);

        // Mark receipt cancelled (never delete)
        FeeReceipt receipt = receiptRepo.findByPayment_Id(paymentId).orElse(null);
        if (receipt != null) {
            receipt.setCancelledAt(Instant.now());
            receipt.setCancelReason(cancelReason);
            receipt = receiptRepo.save(receipt);
        }

        log.info("[AUDIT] fee_payment.cancelled schoolId={} paymentId={} reason='{}'",
                schoolId, paymentId, cancelReason);

        return toDTO(payment, allocations, receipt);
    }

    // ─── mapping ──────────────────────────────────────────────────────────────

    private FeePaymentDTO toDTO(FeePayment p, List<FeePaymentAllocation> allocations, FeeReceipt receipt) {
        FeePaymentDTO dto = baseDTO(p);
        dto.setAllocations(allocations.stream().map(this::toAllocationDTO).collect(Collectors.toList()));
        if (receipt != null) {
            dto.setReceipt(toReceiptDTO(receipt));
        }
        // Compute outstanding balance from the student's current demands
        try {
            Integer schoolId = p.getSchool().getId();
            Integer studentId = p.getStudent().getId();
            List<com.myhaimi.sms.entity.StudentFeeDemand> allDemands =
                    demandRepo.findBySchool_IdAndStudent_Id(schoolId, studentId);
            BigDecimal outstanding = allDemands.stream()
                    .map(d -> d.getBalanceAmount() != null ? d.getBalanceAmount() : BigDecimal.ZERO)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            dto.setOutstandingBalance(outstanding);
        } catch (Exception ignored) { /* non-critical */ }
        return dto;
    }

    private FeePaymentDTO toDTOSummary(FeePayment p) {
        return baseDTO(p);
    }

    private FeePaymentDTO toDTOWithDetails(FeePayment p) {
        List<FeePaymentAllocation> allocations = allocationRepo.findByPayment_Id(p.getId());
        FeeReceipt receipt = receiptRepo.findByPayment_Id(p.getId()).orElse(null);
        return toDTO(p, allocations, receipt);
    }

    private FeePaymentDTO baseDTO(FeePayment p) {
        FeePaymentDTO dto = new FeePaymentDTO();
        dto.setId(p.getId());
        dto.setSchoolId(p.getSchool().getId());
        dto.setStudentId(p.getStudent().getId());
        String firstName = p.getStudent().getFirstName();
        String lastName  = p.getStudent().getLastName();
        dto.setStudentName(firstName + (lastName != null ? " " + lastName : ""));
        dto.setStudentAdmissionNo(p.getStudent().getAdmissionNo());
        // Class/section label
        var cg = p.getStudent().getClassGroup();
        if (cg != null) {
            String label = cg.getDisplayName() != null ? cg.getDisplayName() : cg.getCode();
            dto.setClassGroupName(label);
        }
        dto.setReceiptNo(p.getReceiptNo());
        dto.setAmount(p.getAmount());
        dto.setPaymentMode(p.getPaymentMode().name());
        dto.setPaymentDate(p.getPaymentDate());
        dto.setReferenceNo(p.getReferenceNo());
        dto.setNotes(p.getNotes());
        dto.setStatus(p.getStatus().name());
        dto.setCollectedByUserId(p.getCollectedByUserId());
        dto.setCreatedAt(p.getCreatedAt());
        dto.setUpdatedAt(p.getUpdatedAt());
        return dto;
    }

    private FeePaymentAllocationDTO toAllocationDTO(FeePaymentAllocation a) {
        FeePaymentAllocationDTO dto = new FeePaymentAllocationDTO();
        dto.setId(a.getId());
        StudentFeeDemand d = a.getStudentFeeDemand();
        dto.setDemandId(d.getId());
        dto.setDemandNo(d.getDemandNo());
        // Fee head details for human-readable receipt
        if (d.getFeeHead() != null) {
            dto.setFeeHeadName(d.getFeeHead().getName());
            dto.setFeeHeadCode(d.getFeeHead().getCode());
        }
        // Installment name
        if (d.getInstallment() != null) {
            dto.setInstallmentName(d.getInstallment().getName());
        }
        dto.setAllocatedAmount(a.getAllocatedAmount());
        dto.setDemandPayableAmount(d.getPayableAmount());
        dto.setDemandPaidAmount(d.getPaidAmount());
        dto.setDemandBalanceAmount(d.getBalanceAmount());
        dto.setDemandStatus(d.getStatus().name());
        dto.setCreatedAt(a.getCreatedAt());
        return dto;
    }

    private FeeReceiptDTO toReceiptDTO(FeeReceipt r) {
        FeeReceiptDTO dto = new FeeReceiptDTO();
        dto.setId(r.getId());
        dto.setReceiptNo(r.getReceiptNo());
        dto.setIssuedAt(r.getIssuedAt());
        dto.setPdfUrl(r.getPdfUrl());
        dto.setCancelledAt(r.getCancelledAt());
        dto.setCancelReason(r.getCancelReason());
        return dto;
    }
}

