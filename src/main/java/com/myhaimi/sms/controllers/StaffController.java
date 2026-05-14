package com.myhaimi.sms.controllers;

import com.myhaimi.sms.DTO.staff.*;
import com.myhaimi.sms.service.impl.StaffAccessService;
import com.myhaimi.sms.service.impl.StaffDocumentService;
import com.myhaimi.sms.service.impl.StaffReadinessService;
import com.myhaimi.sms.service.impl.StaffService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/staff")
@RequiredArgsConstructor
public class StaffController {

    private final StaffService          staffService;
    private final StaffDocumentService  staffDocumentService;
    private final StaffAccessService    staffAccessService;
    private final StaffReadinessService staffReadinessService;

    // ── Core CRUD ─────────────────────────────────────────────────────────────

    /** Paginated list — returns {@link StaffSummaryDTO}, never the JPA entity. */
    @GetMapping
    public Page<StaffSummaryDTO> list(Pageable pageable) {
        return staffService.list(pageable);
    }

    /** Full profile including masked payroll fields. */
    @GetMapping("/{id}")
    public ResponseEntity<?> getById(@PathVariable Integer id) {
        try {
            StaffProfileDTO dto = staffService.getById(id);
            return ResponseEntity.ok(dto);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", ex.getMessage()));
        }
    }

    /**
     * @deprecated Use {@code POST /api/v1/onboarding/staff/onboard} with
     * {@link com.myhaimi.sms.DTO.staff.onboarding.StaffOnboardingRequest} instead.
     * Accepting raw JPA entities over HTTP is not permitted for security reasons.
     */
    @PostMapping
    @Deprecated
    public ResponseEntity<?> create() {
        return ResponseEntity.status(HttpStatus.GONE)
                .body(Map.of("error",
                        "This endpoint has been removed. Use POST /api/v1/onboarding/staff/onboard " +
                        "with the structured StaffOnboardingRequest body."));
    }

    // ── Document checklist ────────────────────────────────────────────────────

    @GetMapping("/{staffId}/documents")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public ResponseEntity<?> getDocuments(@PathVariable Integer staffId) {
        try {
            List<StaffDocumentSummaryDTO> docs = staffDocumentService.getDocuments(staffId);
            return ResponseEntity.ok(docs);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    @PatchMapping("/{staffId}/documents/{docId}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public ResponseEntity<?> updateDocument(
            @PathVariable Integer staffId, @PathVariable Integer docId,
            @Valid @RequestBody StaffDocumentUpdateDTO dto, BindingResult result) {
        if (result.hasErrors())
            return ResponseEntity.badRequest().body(Map.of("error", result.getAllErrors().get(0).getDefaultMessage()));
        try { return ResponseEntity.ok(staffDocumentService.updateDocument(staffId, docId, dto)); }
        catch (IllegalArgumentException ex) { return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage())); }
    }

    @PostMapping("/{staffId}/documents/{docId}/collect")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public ResponseEntity<?> collectDocument(
            @PathVariable Integer staffId, @PathVariable Integer docId,
            @RequestBody(required = false) StaffDocumentActionDTO dto) {
        try { return ResponseEntity.ok(staffDocumentService.collectDocument(staffId, docId, dto != null ? dto.getRemarks() : null)); }
        catch (IllegalArgumentException ex) { return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage())); }
    }

    @PostMapping("/{staffId}/documents/{docId}/verify")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public ResponseEntity<?> verifyDocument(
            @PathVariable Integer staffId, @PathVariable Integer docId,
            @RequestBody(required = false) StaffDocumentActionDTO dto) {
        try {
            return ResponseEntity.ok(staffDocumentService.verifyDocument(
                    staffId, docId, dto != null ? dto.getRemarks() : null, dto != null ? dto.getVerificationSource() : null));
        } catch (IllegalArgumentException ex) { return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage())); }
    }

    @PostMapping("/{staffId}/documents/{docId}/reject")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public ResponseEntity<?> rejectDocument(
            @PathVariable Integer staffId, @PathVariable Integer docId,
            @Valid @RequestBody StaffDocumentRejectDTO dto, BindingResult result) {
        if (result.hasErrors())
            return ResponseEntity.badRequest().body(Map.of("error", result.getAllErrors().get(0).getDefaultMessage()));
        try { return ResponseEntity.ok(staffDocumentService.rejectDocument(staffId, docId, dto.getRemarks())); }
        catch (IllegalArgumentException ex) { return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage())); }
    }

    @PostMapping("/{staffId}/documents/{docId}/mark-not-required")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public ResponseEntity<?> markNotRequired(@PathVariable Integer staffId, @PathVariable Integer docId) {
        try { return ResponseEntity.ok(staffDocumentService.markNotRequired(staffId, docId)); }
        catch (IllegalArgumentException ex) { return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage())); }
    }

    /**
     * Upload a file and attach it to a staff document checklist row.
     * Sets uploadStatus=UPLOADED and links the FileObject.
     * POST /api/staff/{staffId}/documents/{docId}/upload
     */
    @PostMapping("/{staffId}/documents/{docId}/upload")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD','TEACHER','CLASS_TEACHER')")
    public ResponseEntity<?> uploadDocumentFile(
            @PathVariable Integer staffId,
            @PathVariable Integer docId,
            @RequestParam("file") MultipartFile file,
            Authentication auth) {
        try {
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(staffDocumentService.uploadDocumentFile(staffId, docId, file, auth));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Upload failed: " + ex.getMessage()));
        }
    }

    // ── Access lifecycle ──────────────────────────────────────────────────────

    @PostMapping("/{staffId}/create-login")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<?> createLogin(
            @PathVariable Integer staffId,
            @RequestBody(required = false) StaffCreateLoginDTO dto) {
        try {
            return ResponseEntity.ok(staffAccessService.createLogin(staffId, dto != null ? dto : new StaffCreateLoginDTO()));
        } catch (IllegalArgumentException ex) { return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage())); }
    }

    @PostMapping("/{staffId}/link-user")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<?> linkUser(
            @PathVariable Integer staffId,
            @Valid @RequestBody StaffLinkUserDTO dto,
            BindingResult result) {
        if (result.hasErrors())
            return ResponseEntity.badRequest().body(Map.of("error", result.getAllErrors().get(0).getDefaultMessage()));
        try { return ResponseEntity.ok(staffAccessService.linkUser(staffId, dto)); }
        catch (IllegalArgumentException ex) { return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage())); }
    }

    @PostMapping("/{staffId}/send-invite")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<?> sendInvite(@PathVariable Integer staffId) {
        try { return ResponseEntity.ok(staffAccessService.sendInvite(staffId)); }
        catch (IllegalArgumentException ex) { return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage())); }
    }

    @PostMapping("/{staffId}/reset-password")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<?> resetPassword(@PathVariable Integer staffId) {
        try { return ResponseEntity.ok(staffAccessService.resetPassword(staffId)); }
        catch (IllegalArgumentException ex) { return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage())); }
    }

    @PostMapping("/{staffId}/disable-login")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<?> disableLogin(@PathVariable Integer staffId) {
        try { return ResponseEntity.ok(staffAccessService.disableLogin(staffId)); }
        catch (IllegalArgumentException ex) { return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage())); }
    }

    @PostMapping("/{staffId}/enable-login")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<?> enableLogin(@PathVariable Integer staffId) {
        try { return ResponseEntity.ok(staffAccessService.enableLogin(staffId)); }
        catch (IllegalArgumentException ex) { return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage())); }
    }

    // ── Readiness dashboard ───────────────────────────────────────────────────

    /**
     * GET /api/staff/readiness
     * Summary KPI cards + six readiness queues.
     * Roles: SCHOOL_ADMIN, PRINCIPAL, VICE_PRINCIPAL, HOD
     */
    @GetMapping("/readiness")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','HOD')")
    public ResponseEntity<?> readiness() {
        try {
            return ResponseEntity.ok(staffReadinessService.build());
        } catch (IllegalStateException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }
}
