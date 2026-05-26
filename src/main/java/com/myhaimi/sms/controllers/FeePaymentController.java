package com.myhaimi.sms.controllers;

import com.myhaimi.sms.DTO.fee.CancelPaymentRequestDTO;
import com.myhaimi.sms.DTO.fee.FeePaymentCreateRequestDTO;
import com.myhaimi.sms.DTO.fee.FeePaymentDTO;
import com.myhaimi.sms.service.impl.FeePaymentService;
import com.myhaimi.sms.service.impl.FeeReceiptPdfService;
import com.myhaimi.sms.utils.CommonUtil;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * REST endpoints for offline/manual fee payment collection.
 *
 * <p>All mutating operations require SCHOOL_ADMIN or ACCOUNTANT role.
 * PRINCIPAL may view but not create/cancel.</p>
 */
@RestController
@RequestMapping("/api/fees/payments")
@RequiredArgsConstructor
public class FeePaymentController {

    private final FeePaymentService feePaymentService;
    private final FeeReceiptPdfService feeReceiptPdfService;

    /**
     * Collect a payment against one or more student fee demands.
     *
     * <p>The request must include at least one allocation. The sum of
     * allocation amounts becomes the payment amount.</p>
     */
    @PostMapping
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','ACCOUNTANT')")
    public ResponseEntity<?> collectPayment(
            @Valid @RequestBody FeePaymentCreateRequestDTO dto,
            BindingResult result) {
        ResponseEntity<?> bindErrors = CommonUtil.dtoBindingResults(result);
        if (bindErrors.getStatusCode().is4xxClientError()) return bindErrors;
        try {
            FeePaymentDTO created = feePaymentService.collectPayment(dto);
            return ResponseEntity.status(HttpStatus.CREATED).body(created);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    /**
     * List payments for the current school with optional filters.
     *
     * <p>Query params: {@code studentId}, {@code paymentMode}, {@code fromDate},
     * {@code toDate}, {@code status}.</p>
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','ACCOUNTANT','PRINCIPAL')")
    public ResponseEntity<List<FeePaymentDTO>> listPayments(
            @RequestParam(required = false) Integer studentId,
            @RequestParam(required = false) String paymentMode,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            @RequestParam(required = false) String status) {
        try {
            return ResponseEntity.ok(feePaymentService.listPayments(studentId, paymentMode, fromDate, toDate, status));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Cancel a payment. Requires a cancel reason.
     * Reverses all demand allocations and marks the receipt cancelled.
     */
    @PostMapping("/{paymentId}/cancel")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','ACCOUNTANT')")
    public ResponseEntity<?> cancelPayment(
            @PathVariable Long paymentId,
            @Valid @RequestBody CancelPaymentRequestDTO dto,
            BindingResult result) {
        ResponseEntity<?> bindErrors = CommonUtil.dtoBindingResults(result);
        if (bindErrors.getStatusCode().is4xxClientError()) return bindErrors;
        try {
            FeePaymentDTO updated = feePaymentService.cancelPayment(paymentId, dto.getCancelReason());
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", ex.getMessage()));
        }
    }

    /**
     * Download official PDF receipt for a payment.
     *
     * <p>Returns a server-generated PDF with school name, student info,
     * payment details, and allocation breakdown. Cross-school access is
     * blocked by the service layer (TenantContext).</p>
     */
    @GetMapping("/{paymentId}/receipt/pdf")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','ACCOUNTANT','PRINCIPAL')")
    public ResponseEntity<?> downloadReceiptPdf(@PathVariable Long paymentId) {
        try {
            byte[] pdfBytes = feeReceiptPdfService.generateReceiptPdf(paymentId);
            // Fetch payment just to get receipt number for filename
            FeePaymentDTO dto = feePaymentService.getPaymentWithDetails(paymentId);
            String receiptNo = dto.getReceiptNo() != null ? dto.getReceiptNo() : "receipt-" + paymentId;
            String filename  = "receipt-" + receiptNo + ".pdf";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_PDF);
            headers.setContentDispositionFormData("attachment", filename);
            headers.setContentLength(pdfBytes.length);
            return new ResponseEntity<>(pdfBytes, headers, HttpStatus.OK);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", ex.getMessage()));
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Could not generate receipt PDF: " + ex.getMessage()));
        }
    }
}

