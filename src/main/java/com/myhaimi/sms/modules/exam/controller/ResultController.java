package com.myhaimi.sms.modules.exam.controller;

import com.myhaimi.sms.modules.exam.dto.ResultActionRequestDTO;
import com.myhaimi.sms.modules.exam.dto.ResultCalculationRequestDTO;
import com.myhaimi.sms.modules.exam.dto.StudentResultDTO;
import com.myhaimi.sms.modules.exam.entity.enums.ResultStatus;
import com.myhaimi.sms.modules.exam.service.ReportCardService;
import com.myhaimi.sms.modules.exam.service.ResultCalculationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Result Calculation and Report Card APIs.
 *
 * <pre>
 * POST /api/exams/results/preview   - preview results (not persisted)
 * POST /api/exams/results/generate  - calculate & persist results
 * POST /api/exams/results/lock      - lock generated results
 * POST /api/exams/results/publish   - publish locked/generated results
 *
 * GET  /api/exams/results                                          - list results
 * GET  /api/students/{studentId}/results                           - student results
 * GET  /api/students/{studentId}/results/{schemeId}/report-card/pdf - PDF report card
 * </pre>
 */
@RestController
@RequiredArgsConstructor
@PreAuthorize("!hasRole('STUDENT') and !hasRole('PARENT')")
public class ResultController {

    private final ResultCalculationService service;
    private final ReportCardService        reportCardService;

    @PostMapping("/api/exams/results/preview")
    public ResponseEntity<List<StudentResultDTO>> preview(
            @Valid @RequestBody ResultCalculationRequestDTO req) {
        return ResponseEntity.ok(service.previewResult(req));
    }

    @PostMapping("/api/exams/results/generate")
    public ResponseEntity<List<StudentResultDTO>> generate(
            @Valid @RequestBody ResultCalculationRequestDTO req) {
        return ResponseEntity.ok(service.generateResults(req));
    }

    @PostMapping("/api/exams/results/lock")
    public ResponseEntity<List<StudentResultDTO>> lock(
            @Valid @RequestBody ResultActionRequestDTO req) {
        return ResponseEntity.ok(service.lockResults(req));
    }

    @PostMapping("/api/exams/results/publish")
    public ResponseEntity<List<StudentResultDTO>> publish(
            @Valid @RequestBody ResultActionRequestDTO req) {
        return ResponseEntity.ok(service.publishResults(req));
    }

    @GetMapping("/api/exams/results")
    public ResponseEntity<List<StudentResultDTO>> list(
            @RequestParam(required = false) Integer classGroupId,
            @RequestParam(required = false) Integer schemeId,
            @RequestParam(required = false) Integer subjectId,
            @RequestParam(required = false) ResultStatus status) {
        return ResponseEntity.ok(service.listResults(classGroupId, schemeId, subjectId, status));
    }

    @GetMapping("/api/students/{studentId}/results")
    public ResponseEntity<List<StudentResultDTO>> getStudentResults(
            @PathVariable Integer studentId) {
        return ResponseEntity.ok(service.getStudentResults(studentId));
    }

    /**
     * Generates and streams a PDF report card for a student.
     * {@code schemeId} identifies the result set (all published results for
     * the student under that scheme are included).
     */
    @GetMapping("/api/students/{studentId}/results/{schemeId}/report-card/pdf")
    public ResponseEntity<byte[]> reportCardPdf(
            @PathVariable Integer studentId,
            @PathVariable Integer schemeId) throws Exception {

        byte[] pdf = reportCardService.generateReportCard(studentId, schemeId);

        String filename = "report-card-student-" + studentId + "-scheme-" + schemeId + ".pdf";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDisposition(
                ContentDisposition.attachment().filename(filename).build());
        headers.setContentLength(pdf.length);

        return ResponseEntity.ok().headers(headers).body(pdf);
    }
}
