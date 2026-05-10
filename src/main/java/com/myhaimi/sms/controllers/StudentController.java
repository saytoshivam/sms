package com.myhaimi.sms.controllers;

import com.myhaimi.sms.DTO.StudentViewDTO;
import com.myhaimi.sms.DTO.student.*;
import com.myhaimi.sms.entity.enums.StudentLifecycleStatus;
import com.myhaimi.sms.service.impl.ParentLoginService;
import com.myhaimi.sms.service.impl.StudentService;
import com.myhaimi.sms.utils.CommonUtil;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/students")
@RequiredArgsConstructor
public class StudentController {
    private final StudentService studentService;
    private final ParentLoginService parentLoginService;

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

    @GetMapping("/{id}")
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
}

