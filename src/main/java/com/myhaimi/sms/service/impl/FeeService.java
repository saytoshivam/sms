package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.FeeInvoiceCreateDTO;
import com.myhaimi.sms.DTO.FeeSchoolSummaryDTO;
import com.myhaimi.sms.DTO.FeeOnlinePaymentIntentRequest;
import com.myhaimi.sms.DTO.FeeOnlinePaymentIntentResponse;
import com.myhaimi.sms.DTO.FeePaymentCreateDTO;
import com.myhaimi.sms.config.PaymentIntegrationProperties;
import com.myhaimi.sms.entity.FeeInvoice;
import com.myhaimi.sms.entity.FeePayment;
import com.myhaimi.sms.entity.School;
import com.myhaimi.sms.entity.Student;
import com.myhaimi.sms.integrations.payments.InternalPaymentOrderService;
import com.myhaimi.sms.integrations.payments.PaymentWebhookPayload;
import com.myhaimi.sms.modules.platform.events.DomainEventPublisher;
import com.myhaimi.sms.modules.platform.events.FeePaidEvent;
import com.myhaimi.sms.repository.FeeInvoiceRepo;
import com.myhaimi.sms.repository.FeePaymentRepo;
import com.myhaimi.sms.repository.SchoolRepo;
import com.myhaimi.sms.repository.StudentRepo;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class FeeService {

    private static final String REF_TYPE_FEE_INVOICE = "FEE_INVOICE";

    private final FeeInvoiceRepo feeInvoiceRepo;
    private final FeePaymentRepo feePaymentRepo;
    private final SchoolRepo schoolRepo;
    private final StudentRepo studentRepo;
    private final InternalPaymentOrderService internalPaymentOrderService;
    private final PaymentIntegrationProperties paymentIntegrationProperties;
    private final DomainEventPublisher domainEventPublisher;

    private Integer requireSchoolId() {
        Integer schoolId = TenantContext.getTenantId();
        if (schoolId == null) {
            schoolId = TenantContext.getSchoolId();
        }
        if (schoolId == null) throw new IllegalStateException("Missing school context");
        return schoolId;
    }

    public Page<FeeInvoice> listInvoices(Pageable pageable) {
        return feeInvoiceRepo.findBySchool_Id(requireSchoolId(), pageable);
    }

    /** Aggregate fee and enrollment stats for the current school (tenant). */
    public FeeSchoolSummaryDTO getSchoolSummary() {
        Integer schoolId = requireSchoolId();
        BigDecimal invoiced = feeInvoiceRepo.sumAmountDueBySchoolId(schoolId);
        BigDecimal collected = feePaymentRepo.sumConfirmedPaymentsBySchoolId(schoolId);
        BigDecimal outstanding = invoiced.subtract(collected);
        if (outstanding.compareTo(BigDecimal.ZERO) < 0) {
            outstanding = BigDecimal.ZERO;
        }
        long students = studentRepo.countBySchool_Id(schoolId);
        long invoiceCount = feeInvoiceRepo.countInvoicesBySchoolId(schoolId);
        long openInvoices = feeInvoiceRepo.countOpenInvoicesBySchoolId(schoolId);
        return new FeeSchoolSummaryDTO(students, invoiced, collected, outstanding, invoiceCount, openInvoices);
    }

    @Transactional
    public FeeInvoice createInvoice(FeeInvoiceCreateDTO dto) {
        Integer schoolId = requireSchoolId();
        School school = schoolRepo.findById(schoolId).orElseThrow();
        Student student = studentRepo.findByIdAndSchool_Id(dto.getStudentId(), schoolId).orElseThrow();

        FeeInvoice inv = new FeeInvoice();
        inv.setSchool(school);
        inv.setStudent(student);
        inv.setAmountDue(dto.getAmountDue());
        inv.setDueDate(dto.getDueDate());
        inv.setStatus("DUE");
        return feeInvoiceRepo.save(inv);
    }

    public List<FeePayment> listPayments(Integer invoiceId) {
        Integer schoolId = requireSchoolId();
        feeInvoiceRepo.findByIdAndSchool_Id(invoiceId, schoolId).orElseThrow();
        return feePaymentRepo.findByInvoice_Id(invoiceId);
    }

    @Transactional
    public FeePayment addPayment(Integer invoiceId, FeePaymentCreateDTO dto) {
        Integer schoolId = requireSchoolId();
        FeeInvoice inv = feeInvoiceRepo.findByIdAndSchool_Id(invoiceId, schoolId).orElseThrow();

        FeePayment p = new FeePayment();
        p.setInvoice(inv);
        p.setAmount(dto.getAmount());
        p.setPaidAt(dto.getPaidAt());
        p.setMethod(dto.getMethod());
        p.setReference(dto.getReference());
        FeePayment saved = feePaymentRepo.save(p);

        recalculateInvoiceStatus(invoiceId);
        return saved;
    }

    /**
     * Creates a pending online payment row and registers an in-process gateway order (no separate payment JVM).
     */
    @Transactional
    public FeeOnlinePaymentIntentResponse createOnlinePaymentIntent(
            Integer invoiceId, FeeOnlinePaymentIntentRequest request, String idempotencyKey) {
        Integer schoolId = requireSchoolId();
        FeeInvoice inv = feeInvoiceRepo.findByIdAndSchool_Id(invoiceId, schoolId).orElseThrow();

        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            FeePayment existing = feePaymentRepo.findByIdempotencyKey(idempotencyKey).orElse(null);
            if (existing != null && existing.getInvoice().getId().equals(invoiceId)) {
                return toIntentResponse(existing, inv);
            }
        }

        BigDecimal remaining = remainingBalanceExcludingPendingGateway(invoiceId, inv.getAmountDue());
        if (remaining.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Invoice has no remaining balance to pay online");
        }

        BigDecimal payAmount = request != null && request.amount() != null ? request.amount() : remaining;
        if (payAmount.compareTo(BigDecimal.ZERO) <= 0 || payAmount.compareTo(remaining) > 0) {
            throw new IllegalArgumentException("Invalid payment amount");
        }

        FeePayment p = new FeePayment();
        p.setInvoice(inv);
        p.setAmount(payAmount);
        p.setPaidAt(LocalDateTime.now());
        p.setMethod("ONLINE");
        p.setGatewayStatus("PENDING");
        p.setIdempotencyKey(idempotencyKey != null && !idempotencyKey.isBlank() ? idempotencyKey : null);
        p = feePaymentRepo.save(p);

        String notifyUrl = paymentIntegrationProperties.getPublicBaseUrl().replaceAll("/$", "")
                + "/api/v1/integrations/payments/webhook";
        try {
            InternalPaymentOrderService.CreateOrderResult ord = internalPaymentOrderService.createOrder(
                    schoolId,
                    REF_TYPE_FEE_INVOICE,
                    String.valueOf(invoiceId),
                    payAmount,
                    "INR",
                    notifyUrl,
                    idempotencyKey);
            p.setGatewayOrderId(ord.orderId());
            p.setReference(ord.orderId());
            feePaymentRepo.save(p);
        } catch (RuntimeException ex) {
            p.setGatewayStatus("FAILED");
            feePaymentRepo.save(p);
            throw ex;
        }

        FeeInvoice refreshed = feeInvoiceRepo.findById(invoiceId).orElseThrow();
        return toIntentResponse(p, refreshed);
    }

    @Transactional
    public void applyGatewayPaymentConfirmation(PaymentWebhookPayload payload) {
        if (!"SUCCEEDED".equalsIgnoreCase(payload.status())) {
            return;
        }
        FeePayment p = feePaymentRepo.findByGatewayOrderId(payload.orderId()).orElseThrow();
        if ("SUCCEEDED".equalsIgnoreCase(p.getGatewayStatus())) {
            return;
        }
        if (!Objects.equals(p.getInvoice().getId(), payload.referenceId())) {
            throw new IllegalArgumentException("referenceId does not match payment order");
        }
        if (!REF_TYPE_FEE_INVOICE.equalsIgnoreCase(payload.referenceType())) {
            throw new IllegalArgumentException("Unsupported reference type");
        }

        p.setGatewayStatus("SUCCEEDED");
        feePaymentRepo.save(p);

        recalculateInvoiceStatus(p.getInvoice().getId());

        FeeInvoice inv = feeInvoiceRepo.findById(p.getInvoice().getId()).orElseThrow();
        domainEventPublisher.publishFeePaid(
                new FeePaidEvent(
                        Instant.now(),
                        inv.getSchool().getId(),
                        inv.getId(),
                        p.getId(),
                        inv.getStudent().getId(),
                        p.getGatewayOrderId(),
                        p.getAmount(),
                        inv.getStatus()));
    }

    private FeeOnlinePaymentIntentResponse toIntentResponse(FeePayment p, FeeInvoice inv) {
        return new FeeOnlinePaymentIntentResponse(
                p.getId(), p.getGatewayOrderId(), p.getGatewayStatus(), p.getAmount(), inv.getStatus());
    }

    private BigDecimal remainingBalanceExcludingPendingGateway(Integer invoiceId, BigDecimal amountDue) {
        BigDecimal confirmed = feePaymentRepo.findByInvoice_Id(invoiceId).stream()
                .filter(x -> x.getGatewayStatus() == null || "SUCCEEDED".equalsIgnoreCase(x.getGatewayStatus()))
                .map(FeePayment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return amountDue.subtract(confirmed);
    }

    private void recalculateInvoiceStatus(Integer invoiceId) {
        FeeInvoice inv = feeInvoiceRepo.findById(invoiceId).orElseThrow();
        BigDecimal totalPaid = feePaymentRepo.findByInvoice_Id(invoiceId).stream()
                .filter(p -> p.getGatewayStatus() == null || "SUCCEEDED".equalsIgnoreCase(p.getGatewayStatus()))
                .map(FeePayment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (totalPaid.compareTo(inv.getAmountDue()) >= 0) {
            inv.setStatus("PAID");
        } else if (totalPaid.compareTo(BigDecimal.ZERO) > 0) {
            inv.setStatus("PARTIAL");
        } else {
            inv.setStatus("DUE");
        }
        feeInvoiceRepo.save(inv);
    }
}
