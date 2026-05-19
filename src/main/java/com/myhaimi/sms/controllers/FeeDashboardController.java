package com.myhaimi.sms.controllers;

import com.myhaimi.sms.DTO.fee.*;
import com.myhaimi.sms.service.impl.FeeDashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Fee Dashboard KPIs and basic report endpoints.
 *
 * <p>All endpoints are school-scoped via JWT / TenantContext.
 * Add {@code ?export=csv} to any report endpoint to download a CSV file.</p>
 */
@RestController
@RequestMapping("/api/fees")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('SCHOOL_ADMIN','ACCOUNTANT','PRINCIPAL')")
public class FeeDashboardController {

    private final FeeDashboardService dashboardService;

    // ─── Dashboard ────────────────────────────────────────────────────────────

    /**
     * GET /api/fees/dashboard?academicYearId=
     */
    @GetMapping("/dashboard")
    public ResponseEntity<?> dashboard(
            @RequestParam(required = false) Integer academicYearId) {
        try {
            return ResponseEntity.ok(dashboardService.getDashboard(academicYearId));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    // ─── Reports ──────────────────────────────────────────────────────────────

    /**
     * GET /api/fees/reports/daily-collection
     * ?fromDate=yyyy-MM-dd&toDate=yyyy-MM-dd&paymentMode=CASH&export=csv
     */
    @GetMapping("/reports/daily-collection")
    public ResponseEntity<?> dailyCollection(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            @RequestParam(required = false) String paymentMode,
            @RequestParam(defaultValue = "false") boolean export) {
        try {
            List<DailyCollectionRowDTO> data = dashboardService.dailyCollectionReport(fromDate, toDate, paymentMode);
            if (export) return csvResponse(dashboardService.toDailyCsv(data), "daily-collection.csv");
            return ResponseEntity.ok(data);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    /**
     * GET /api/fees/reports/class-outstanding
     * ?academicYearId=&classGroupId=&section=&export=csv
     */
    @GetMapping("/reports/class-outstanding")
    public ResponseEntity<?> classOutstanding(
            @RequestParam(required = false) Integer academicYearId,
            @RequestParam(required = false) Integer classGroupId,
            @RequestParam(required = false) String section,
            @RequestParam(defaultValue = "false") boolean export) {
        try {
            List<ClassOutstandingRowDTO> data = dashboardService.classOutstandingReport(academicYearId, classGroupId, section);
            if (export) return csvResponse(dashboardService.toClassOutstandingCsv(data), "class-outstanding.csv");
            return ResponseEntity.ok(data);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    /**
     * GET /api/fees/reports/student-dues
     * ?academicYearId=&classGroupId=&section=&export=csv
     */
    @GetMapping("/reports/student-dues")
    public ResponseEntity<?> studentDues(
            @RequestParam(required = false) Integer academicYearId,
            @RequestParam(required = false) Integer classGroupId,
            @RequestParam(required = false) String section,
            @RequestParam(defaultValue = "false") boolean export) {
        try {
            List<StudentDueRowDTO> data = dashboardService.studentDueReport(academicYearId, classGroupId, section);
            if (export) return csvResponse(dashboardService.toStudentDueCsv(data), "student-dues.csv");
            return ResponseEntity.ok(data);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    /**
     * GET /api/fees/reports/payment-mode
     * ?fromDate=yyyy-MM-dd&toDate=yyyy-MM-dd&export=csv
     */
    @GetMapping("/reports/payment-mode")
    public ResponseEntity<?> paymentMode(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            @RequestParam(defaultValue = "false") boolean export) {
        try {
            List<PaymentModeRowDTO> data = dashboardService.paymentModeReport(fromDate, toDate);
            if (export) return csvResponse(dashboardService.toPaymentModeCsv(data), "payment-mode.csv");
            return ResponseEntity.ok(data);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    /**
     * GET /api/fees/reports/receipt-register
     * ?fromDate=yyyy-MM-dd&toDate=yyyy-MM-dd&paymentMode=&studentId=&export=csv
     */
    @GetMapping("/reports/receipt-register")
    public ResponseEntity<?> receiptRegister(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            @RequestParam(required = false) String paymentMode,
            @RequestParam(required = false) Integer studentId,
            @RequestParam(defaultValue = "false") boolean export) {
        try {
            List<ReceiptRegisterRowDTO> data = dashboardService.receiptRegister(fromDate, toDate, paymentMode, studentId);
            if (export) return csvResponse(dashboardService.toReceiptRegisterCsv(data), "receipt-register.csv");
            return ResponseEntity.ok(data);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    // ─── helper ───────────────────────────────────────────────────────────────

    private ResponseEntity<byte[]> csvResponse(String csv, String filename) {
        byte[] bytes = csv.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .contentLength(bytes.length)
                .body(bytes);
    }
}

