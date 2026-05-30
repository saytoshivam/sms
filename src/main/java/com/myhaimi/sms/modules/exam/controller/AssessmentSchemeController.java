package com.myhaimi.sms.modules.exam.controller;

import com.myhaimi.sms.modules.exam.dto.*;
import com.myhaimi.sms.modules.exam.service.AssessmentSchemeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Examination module – Assessment Scheme & Grading Scheme APIs.
 *
 * <pre>
 * GET    /api/exams/schemes
 * POST   /api/exams/schemes
 * GET    /api/exams/schemes/{schemeId}
 * PUT    /api/exams/schemes/{schemeId}
 * POST   /api/exams/schemes/{schemeId}/publish
 * POST   /api/exams/schemes/{schemeId}/archive
 * POST   /api/exams/schemes/{schemeId}/clone
 *
 * POST   /api/exams/schemes/{schemeId}/components
 * PUT    /api/exams/schemes/{schemeId}/components/{componentId}
 * DELETE /api/exams/schemes/{schemeId}/components/{componentId}
 *
 * GET    /api/exams/grading-schemes
 * POST   /api/exams/grading-schemes
 * </pre>
 */
@RestController
@RequestMapping("/api/exams")
@RequiredArgsConstructor
@PreAuthorize("!hasRole('STUDENT') and !hasRole('PARENT')")
public class AssessmentSchemeController {

    private final AssessmentSchemeService service;

    // ─────────────────────────────── Schemes ─────────────────────────────────

    @GetMapping("/schemes")
    public ResponseEntity<List<AssessmentSchemeDTO>> listSchemes() {
        return ResponseEntity.ok(service.listSchemes());
    }

    @PostMapping("/schemes")
    public ResponseEntity<AssessmentSchemeDTO> createScheme(@Valid @RequestBody AssessmentSchemeCreateDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createScheme(dto));
    }

    @GetMapping("/schemes/{schemeId}")
    public ResponseEntity<AssessmentSchemeDTO> getScheme(@PathVariable Integer schemeId) {
        return ResponseEntity.ok(service.getScheme(schemeId));
    }

    @PutMapping("/schemes/{schemeId}")
    public ResponseEntity<AssessmentSchemeDTO> updateScheme(
            @PathVariable Integer schemeId,
            @Valid @RequestBody AssessmentSchemeUpdateDTO dto) {
        return ResponseEntity.ok(service.updateScheme(schemeId, dto));
    }

    @PostMapping("/schemes/{schemeId}/publish")
    public ResponseEntity<AssessmentSchemeDTO> publishScheme(@PathVariable Integer schemeId) {
        return ResponseEntity.ok(service.publishScheme(schemeId));
    }

    @PostMapping("/schemes/{schemeId}/archive")
    public ResponseEntity<AssessmentSchemeDTO> archiveScheme(@PathVariable Integer schemeId) {
        return ResponseEntity.ok(service.archiveScheme(schemeId));
    }

    @PostMapping("/schemes/{schemeId}/clone")
    public ResponseEntity<AssessmentSchemeDTO> cloneScheme(@PathVariable Integer schemeId) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.cloneScheme(schemeId));
    }

    // ─────────────────────────────── Components ──────────────────────────────

    @PostMapping("/schemes/{schemeId}/components")
    public ResponseEntity<AssessmentSchemeDTO> addComponent(
            @PathVariable Integer schemeId,
            @Valid @RequestBody AssessmentComponentCreateDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.addComponent(schemeId, dto));
    }

    @PutMapping("/schemes/{schemeId}/components/{componentId}")
    public ResponseEntity<AssessmentSchemeDTO> updateComponent(
            @PathVariable Integer schemeId,
            @PathVariable Integer componentId,
            @Valid @RequestBody AssessmentComponentCreateDTO dto) {
        return ResponseEntity.ok(service.updateComponent(schemeId, componentId, dto));
    }

    @DeleteMapping("/schemes/{schemeId}/components/{componentId}")
    public ResponseEntity<Void> removeComponent(
            @PathVariable Integer schemeId,
            @PathVariable Integer componentId) {
        service.removeComponent(schemeId, componentId);
        return ResponseEntity.noContent().build();
    }

    // ─────────────────────────────── Grading Schemes ─────────────────────────

    @GetMapping("/grading-schemes")
    public ResponseEntity<List<GradingSchemeDTO>> listGradingSchemes() {
        return ResponseEntity.ok(service.listGradingSchemes());
    }

    @PostMapping("/grading-schemes")
    public ResponseEntity<GradingSchemeDTO> createGradingScheme(@Valid @RequestBody GradingSchemeCreateDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createGradingScheme(dto));
    }
}
