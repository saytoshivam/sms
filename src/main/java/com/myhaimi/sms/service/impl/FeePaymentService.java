package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.fee.*;
import com.myhaimi.sms.entity.*;
import com.myhaimi.sms.entity.enums.PaymentMode;
import com.myhaimi.sms.entity.enums.PaymentStatus;
import com.myhaimi.sms.entity.enums.StudentFeeDemandStatus;
import com.myhaimi.sms.repository.*;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Handles offline/manual fee payment collection against student fee demands.
 *
 * <p>Business rules enforced:
 * <ul>
 *   <li>Allocated amount per demand ≤ demand balance amount.</li>
 *   <li>Sum of allocations must equal the payment amount.</li>
 *   <li>Demand statuses are updated after payment (PAID / PARTIAL / UNPAID).</li>
 *   <li>Receipt number is unique per school: RCPT-{year}-{seq:06d}.</li>
 *   <li>Cancellation reverses all allocations and marks demands appropriately.</li>
 * </ul>
 * </p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FeePaymentService {

    private final FeePaymentRepo paymentRepo;
    private final FeePaymentAllocationRepository allocationRepo;
    private final FeeReceiptRepository receiptRepo;
    private final StudentFeeDemandRepository demandRepo;
    private final StudentRepo studentRepo;
    private final SchoolRepo schoolRepo;
    private final UserRepo userRepo;

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

    private String buildReceiptNo(Integer schoolId, LocalDate paymentDate) {
        long seq = paymentRepo.nextReceiptSequence(schoolId);
        int year = paymentDate.getYear();
        return String.format("RCPT-%d-%06d", year, seq);
    }

    private void updateDemandStatus(StudentFeeDemand demand) {
        BigDecimal paid = demand.getPaidAmount() != null ? demand.getPaidAmount() : BigDecimal.ZERO;
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
        School school = requireSchool(schoolId);

        Student student = studentRepo.findByIdAndSchool_Id(req.getStudentId(), schoolId)
                .orElseThrow(() -> new IllegalArgumentException("Student not found: " + req.getStudentId()));

        // Validate payment mode
        PaymentMode mode;
        try {
            mode = PaymentMode.valueOf(req.getPaymentMode().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid paymentMode: " + req.getPaymentMode());
        }

        // Validate allocations and load demands
        List<StudentFeeDemand> demands = new ArrayList<>();
        BigDecimal totalAllocated = BigDecimal.ZERO;
        for (FeePaymentCreateRequestDTO.AllocationItemDTO alloc : req.getAllocations()) {
            StudentFeeDemand demand = demandRepo.findByIdAndSchool_Id(alloc.getDemandId(), schoolId)
                    .orElseThrow(() -> new IllegalArgumentException("Demand not found: " + alloc.getDemandId()));

            if (!demand.getStudent().getId().equals(req.getStudentId())) {
                throw new IllegalArgumentException(
                        "Demand " + alloc.getDemandId() + " does not belong to student " + req.getStudentId());
            }

            BigDecimal balance = demand.getBalanceAmount() != null ? demand.getBalanceAmount() : BigDecimal.ZERO;
            if (alloc.getAmount().compareTo(balance) > 0) {
                throw new IllegalArgumentException(
                        "Allocated amount " + alloc.getAmount() + " exceeds balance " + balance
                                + " for demand " + demand.getDemandNo());
            }
            if (alloc.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalArgumentException(
                        "Allocated amount must be positive for demand " + demand.getDemandNo());
            }

            demands.add(demand);
            totalAllocated = totalAllocated.add(alloc.getAmount());
        }

        // Compute total from allocations (payment amount = sum of allocations)
        BigDecimal paymentAmount = totalAllocated;

        // Build and save payment
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

        // Create allocations and update demands
        List<FeePaymentAllocation> savedAllocations = new ArrayList<>();
        for (int i = 0; i < req.getAllocations().size(); i++) {
            FeePaymentCreateRequestDTO.AllocationItemDTO allocReq = req.getAllocations().get(i);
            StudentFeeDemand demand = demands.get(i);

            FeePaymentAllocation allocation = new FeePaymentAllocation();
            allocation.setPayment(payment);
            allocation.setStudentFeeDemand(demand);
            allocation.setAllocatedAmount(allocReq.getAmount());
            savedAllocations.add(allocationRepo.save(allocation));

            // Update demand paid/balance
            BigDecimal newPaid = demand.getPaidAmount().add(allocReq.getAmount());
            demand.setPaidAmount(newPaid);
            demand.recalculate();
            updateDemandStatus(demand);
            demandRepo.save(demand);
        }

        // Create receipt
        FeeReceipt receipt = new FeeReceipt();
        receipt.setPayment(payment);
        receipt.setReceiptNo(payment.getReceiptNo());
        receipt.setIssuedAt(Instant.now());
        receipt = receiptRepo.save(receipt);

        // TODO: audit(fee_payment.collected, schoolId, paymentId, receiptNo, amount, collectedByUserId)
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

    // ─── cancel payment ───────────────────────────────────────────────────────

    @Transactional
    public FeePaymentDTO cancelPayment(Long paymentId, String cancelReason) {
        Integer schoolId = requireSchoolId();

        FeePayment payment = paymentRepo.findByIdAndSchool_Id(paymentId, schoolId)
                .orElseThrow(() -> new IllegalArgumentException("Payment not found: " + paymentId));

        if (payment.getStatus() == PaymentStatus.CANCELLED) {
            throw new IllegalStateException("Payment is already cancelled");
        }
        if (cancelReason == null || cancelReason.isBlank()) {
            throw new IllegalArgumentException("cancelReason is required");
        }

        // Reverse allocations — subtract from demand paidAmount and recalculate
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

        // Mark payment cancelled
        payment.setStatus(PaymentStatus.CANCELLED);
        payment = paymentRepo.save(payment);

        // Mark receipt cancelled
        FeeReceipt receipt = receiptRepo.findByPayment_Id(paymentId).orElse(null);
        if (receipt != null) {
            receipt.setCancelledAt(Instant.now());
            receipt.setCancelReason(cancelReason);
            receipt = receiptRepo.save(receipt);
        }

        // TODO: audit(fee_payment.cancelled, schoolId, paymentId, cancelledByUserId, reason)
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
        return dto;
    }

    private FeePaymentDTO toDTOSummary(FeePayment p) {
        FeePaymentDTO dto = baseDTO(p);
        return dto;
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
        String lastName = p.getStudent().getLastName();
        dto.setStudentName(firstName + (lastName != null ? " " + lastName : ""));
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

