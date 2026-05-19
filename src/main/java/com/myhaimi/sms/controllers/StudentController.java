package com.myhaimi.sms.controllers;

import com.myhaimi.sms.DTO.StudentViewDTO;
import com.myhaimi.sms.DTO.fee.FeePaymentDTO;
import com.myhaimi.sms.DTO.fee.StudentFeeDemandDTO;
import com.myhaimi.sms.DTO.fee.StudentFeeLedgerDTO;
import com.myhaimi.sms.DTO.student.*;
import com.myhaimi.sms.entity.enums.StudentLifecycleStatus;
import com.myhaimi.sms.service.impl.FeeDemandService;
import com.myhaimi.sms.service.impl.FeePaymentService;
import com.myhaimi.sms.service.impl.ParentLoginService;
import com.myhaimi.sms.service.impl.StudentFeeLedgerService;
import com.myhaimi.sms.service.impl.StudentLoginService;
import com.myhaimi.sms.service.impl.StudentService;
import com.myhaimi.sms.utils.CommonUtil;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api/students")
@RequiredArgsConstructor
public class StudentController {
    private final StudentService studentService;
    private final ParentLoginService parentLoginService;
    private final StudentLoginService studentLoginService;
    private final FeeDemandService feeDemandService;
    private final FeePaymentService feePaymentService;
    private final StudentFeeLedgerService feeLedgerService;

    /** Converts access-denied errors to HTTP 403 with a JSON body. */
    @org.springframework.web.bind.annotation.ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, String>> handleAccessDenied(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", ex.getMessage()));
    }

    @GetMapping
    public ResponseEntity<?> list(
            Pageable pageable,
            @RequestParam(required = false) Integer classGroupId,
            @RequestParam(required = false) StudentLifecycleStatus status,
            @RequestParam(required = false) Integer gradeLevel,
            @RequestParam(required = false) String section,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "false") boolean noGuardian,
            @RequestParam(defaultValue = "false") boolean noSection) {
        return ResponseEntity.ok(studentService.list(pageable, classGroupId, status, gradeLevel, section, search, noGuardian, noSection));
    }

    @GetMapping("/roster-health")
    public ResponseEntity<?> rosterHealth() {
        try {
            return ResponseEntity.ok(studentService.rosterHealth());
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    @DeleteMapping("/delete-all")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<Void> deleteAllStudents() {
        studentService.deleteAllStudentsForSchool();
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id:[0-9]+}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<?> deleteStudent(@PathVariable Integer id) {
        try {
            studentService.deleteStudent(id);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", ex.getMessage()));
        }
    }

    @GetMapping("/{id:[0-9]+}")
    public ResponseEntity<?> getOne(@PathVariable Integer id) {
        try {
            return ResponseEntity.ok(studentService.getProfile(id));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping
    public ResponseEntity<?> create(
            @Valid @RequestBody StudentOnboardingCreateDTO dto, BindingResult result) {
        ResponseEntity<?> res = CommonUtil.dtoBindingResults(result);
        if (res.getStatusCode().is4xxClientError()) return res;
        try {
            StudentProfileSummaryDTO created = studentService.onboard(dto);
            return ResponseEntity.status(HttpStatus.CREATED).body(created);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateProfile(
            @PathVariable Integer id, @Valid @RequestBody StudentUpdateDTO dto, BindingResult result) {
        ResponseEntity<?> res = CommonUtil.dtoBindingResults(result);
        if (res.getStatusCode().is4xxClientError()) return res;
        try {
            return ResponseEntity.ok(studentService.updateProfile(id, dto));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    @PutMapping("/{id}/medical")
    public ResponseEntity<?> upsertMedical(
            @PathVariable Integer id,
            @Valid @RequestBody StudentMedicalUpsertPayload dto,
            BindingResult result) {
        ResponseEntity<?> res = CommonUtil.dtoBindingResults(result);
        if (res.getStatusCode().is4xxClientError()) return res;
        try {
            return ResponseEntity.ok(studentService.upsertMedical(id, dto));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    @PutMapping("/{studentId}/guardians/{guardianId}")
    public ResponseEntity<?> updateGuardian(
            @PathVariable Integer studentId,
            @PathVariable Integer guardianId,
            @Valid @RequestBody GuardianUpdateDTO dto,
            BindingResult result) {
        ResponseEntity<?> res = CommonUtil.dtoBindingResults(result);
        if (res.getStatusCode().is4xxClientError()) return res;
        try {
            return ResponseEntity.ok(studentService.updateGuardian(studentId, guardianId, dto));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/{studentId}/guardians/{guardianId}/set-primary")
    public ResponseEntity<?> setPrimaryGuardian(
            @PathVariable Integer studentId,
            @PathVariable Integer guardianId) {
        try {
            return ResponseEntity.ok(studentService.setPrimaryGuardian(studentId, guardianId));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/{studentId}/guardians/{guardianId}/create-login")
    public ResponseEntity<?> createParentLogin(
            @PathVariable Integer studentId,
            @PathVariable Integer guardianId) {
        try {
            return ResponseEntity.ok(parentLoginService.createOrLink(studentId, guardianId));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/{studentId}/create-login")
    public ResponseEntity<?> createStudentLogin(@PathVariable Integer studentId) {
        try {
            return ResponseEntity.ok(studentLoginService.createLogin(studentId));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        } catch (IllegalStateException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/{id}/transfer-section")
    public ResponseEntity<?> transferSection(
            @PathVariable Integer id,
            @Valid @RequestBody SectionTransferDTO dto,
            BindingResult result) {
        ResponseEntity<?> res = CommonUtil.dtoBindingResults(result);
        if (res.getStatusCode().is4xxClientError()) return res;
        try {
            return ResponseEntity.ok(studentService.transferSection(id, dto));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    // === Document Lifecycle Endpoints ===

    @PostMapping("/{studentId}/documents/{docId}/collect")
    public ResponseEntity<?> collectDocument(
            @PathVariable Integer studentId,
            @PathVariable Integer docId,
            @RequestBody(required = false) StudentDocumentActionDTO dto) {
        try {
            String remarks = (dto != null) ? dto.getRemarks() : null;
            return ResponseEntity.ok(studentService.collectDocument(studentId, docId, remarks));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        } catch (AccessDeniedException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/{studentId}/documents/{docId}/mark-pending")
    public ResponseEntity<?> markDocumentPending(
            @PathVariable Integer studentId,
            @PathVariable Integer docId) {
        try {
            return ResponseEntity.ok(studentService.markDocumentPending(studentId, docId));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        } catch (AccessDeniedException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/{studentId}/documents/{docId}/mark-not-required")
    public ResponseEntity<?> markDocumentNotRequired(
            @PathVariable Integer studentId,
            @PathVariable Integer docId) {
        try {
            return ResponseEntity.ok(studentService.markDocumentNotRequired(studentId, docId));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        } catch (AccessDeniedException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/{studentId}/documents/{docId}/verify")
    public ResponseEntity<?> verifyDocument(
            @PathVariable Integer studentId,
            @PathVariable Integer docId,
            @RequestBody(required = false) StudentDocumentActionDTO dto) {
        try {
            String remarks = (dto != null) ? dto.getRemarks() : null;
            var source = (dto != null) ? dto.getVerificationSource() : null;
            return ResponseEntity.ok(studentService.verifyDocument(studentId, docId, remarks, source));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        } catch (AccessDeniedException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/{studentId}/documents/{docId}/reject")
    public ResponseEntity<?> rejectDocument(
            @PathVariable Integer studentId,
            @PathVariable Integer docId,
            @Valid @RequestBody StudentDocumentRejectDTO dto,
            BindingResult result) {
        ResponseEntity<?> res = CommonUtil.dtoBindingResults(result);
        if (res.getStatusCode().is4xxClientError()) return res;
        try {
            return ResponseEntity.ok(studentService.rejectDocument(studentId, docId, dto.getRemarks()));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        } catch (AccessDeniedException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", ex.getMessage()));
        }
    }

    @PatchMapping("/{studentId}/documents/{docId}")
    public ResponseEntity<?> updateDocument(
            @PathVariable Integer studentId,
            @PathVariable Integer docId,
            @Valid @RequestBody StudentDocumentUpdateDTO dto,
            BindingResult result) {
        ResponseEntity<?> res = CommonUtil.dtoBindingResults(result);
        if (res.getStatusCode().is4xxClientError()) return res;
        try {
            return ResponseEntity.ok(studentService.updateDocument(studentId, docId, dto));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        } catch (AccessDeniedException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", ex.getMessage()));
        }
    }

    // === File Upload Endpoints (student-specific) ===

    /**
     * Upload a file and attach it to a student document checklist row.
     * Sets uploadStatus=UPLOADED and links the FileObject.
     * POST /api/students/{studentId}/documents/{docId}/upload
     */
    @PostMapping("/{studentId}/documents/{docId}/upload")
    public ResponseEntity<?> uploadDocumentFile(
            @PathVariable Integer studentId,
            @PathVariable Integer docId,
            @RequestParam("file") MultipartFile file,
            Authentication auth) {
        try {
            StudentDocumentSummaryDTO result =
                    studentService.uploadDocumentFile(studentId, docId, file, auth);
            return ResponseEntity.status(HttpStatus.CREATED).body(result);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        } catch (AccessDeniedException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", ex.getMessage()));
        }
    }

    /**
     * Upload a profile photo for a student.
     * Stores FileObject id in student.profilePhotoFileId.
     * Frontend must call GET /api/files/{profilePhotoFileId}/download-url to get the signed image URL.
     * POST /api/students/{studentId}/profile-photo
     */
    @PostMapping("/{studentId}/profile-photo")
    public ResponseEntity<?> uploadProfilePhoto(
            @PathVariable Integer studentId,
            @RequestParam("file") MultipartFile file,
            Authentication auth) {
        try {
            StudentProfileSummaryDTO result =
                    studentService.uploadProfilePhoto(studentId, file, auth);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        } catch (AccessDeniedException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", ex.getMessage()));
        }
    }

    /**
     * GET /api/students/{studentId}/fees/demands
     * Returns all fee demands for a specific student in the current school.
     */
    @GetMapping("/{studentId}/fees/demands")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','ACCOUNTANT','PRINCIPAL')")
    public ResponseEntity<java.util.List<StudentFeeDemandDTO>> getStudentFeeDemands(
            @PathVariable Integer studentId) {
        return ResponseEntity.ok(feeDemandService.getStudentDemands(studentId));
    }

    /**
     * GET /api/students/{studentId}/fees/payments
     * Returns payment history for a specific student in the current school.
     */
    @GetMapping("/{studentId}/fees/payments")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','ACCOUNTANT','PRINCIPAL')")
    public ResponseEntity<java.util.List<FeePaymentDTO>> getStudentFeePayments(
            @PathVariable Integer studentId) {
        try {
            return ResponseEntity.ok(feePaymentService.listPaymentsForStudent(studentId));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * GET /api/students/{studentId}/fees/ledger
     *
     * <p>Returns a computed fee ledger for the student showing demands (debits),
     * payments (credits), and running balance.  The ledger is generated on-the-fly
     * from existing records — not persisted.</p>
     *
     * <p>Access: SCHOOL_ADMIN, ACCOUNTANT, PRINCIPAL can view any student's ledger.
     * (Parent / student self-access will be added in the portal phase.)</p>
     */
    @GetMapping("/{studentId}/fees/ledger")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','ACCOUNTANT','PRINCIPAL')")
    public ResponseEntity<?> getStudentFeeLedger(@PathVariable Integer studentId) {
        try {
            StudentFeeLedgerDTO ledger = feeLedgerService.getLedger(studentId);
            return ResponseEntity.ok(ledger);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

}


