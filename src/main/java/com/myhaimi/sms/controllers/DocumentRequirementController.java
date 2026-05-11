package com.myhaimi.sms.controllers;

import com.myhaimi.sms.DTO.docreq.*;
import com.myhaimi.sms.entity.enums.DocumentTargetType;
import com.myhaimi.sms.service.impl.DocumentRequirementService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Document Requirement Configuration API.
 *
 * GET  /api/document-types                          — system document type catalogue
 * GET  /api/schools/document-requirements           — school's configured requirements
 * PUT  /api/schools/document-requirements           — save/replace school requirements
 * POST /api/schools/document-requirements/apply-to-students — apply to existing students
 */
@RestController
@RequiredArgsConstructor
public class DocumentRequirementController {

    private final DocumentRequirementService service;

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, String>> handleAccessDenied(AccessDeniedException ex) {
        return ResponseEntity.status(403).body(Map.of("error", ex.getMessage()));
    }

    // ── Document types (master catalogue) ────────────────────────────────────

    @GetMapping("/api/document-types")
    public ResponseEntity<?> listDocumentTypes(
            @RequestParam(required = false) DocumentTargetType targetType) {
        try {
            return ResponseEntity.ok(service.listDocumentTypes(targetType));
        } catch (Exception ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    // ── School requirements ───────────────────────────────────────────────────

    @GetMapping("/api/schools/document-requirements")
    public ResponseEntity<?> getRequirements(
            @RequestParam DocumentTargetType targetType) {
        try {
            return ResponseEntity.ok(service.getSchoolRequirements(targetType));
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(400).body(Map.of("error", ex.getMessage()));
        } catch (Exception ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    @PutMapping("/api/schools/document-requirements")
    public ResponseEntity<?> saveRequirements(
            @RequestBody SaveDocumentRequirementsPayload payload) {
        try {
            return ResponseEntity.ok(service.saveRequirements(payload));
        } catch (AccessDeniedException ex) {
            return ResponseEntity.status(403).body(Map.of("error", ex.getMessage()));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/api/schools/document-requirements/apply-to-students")
    public ResponseEntity<?> applyToStudents() {
        try {
            return ResponseEntity.ok(service.applyRequirementsToExistingStudents());
        } catch (AccessDeniedException ex) {
            return ResponseEntity.status(403).body(Map.of("error", ex.getMessage()));
        } catch (Exception ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }
}

