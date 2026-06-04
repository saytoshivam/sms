package com.myhaimi.sms.modules.exam.controller;

import com.myhaimi.sms.modules.exam.dto.*;
import com.myhaimi.sms.modules.exam.service.AssessmentScheduleService;
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
 * POST   /api/exams/schemes/{schemeId}/assignments
 * DELETE /api/exams/schemes/{schemeId}/assignments/{assignmentId}
 *
 * POST   /api/exams/schemes/{schemeId}/components
 * PUT    /api/exams/schemes/{schemeId}/components/{componentId}
 * DELETE /api/exams/schemes/{schemeId}/components/{componentId}
 *
 * GET    /api/exams/grading-schemes
 * POST   /api/exams/grading-schemes
 * GET    /api/exams/grading-schemes/{schemeId}
 * PUT    /api/exams/grading-schemes/{schemeId}
 * POST   /api/exams/grading-schemes/{schemeId}/publish
 * POST   /api/exams/grading-schemes/{schemeId}/archive
 * POST   /api/exams/grading-schemes/{schemeId}/clone
 * POST   /api/exams/grading-schemes/{schemeId}/set-default
 * </pre>
 */
@RestController
@RequestMapping("/api/exams")
@RequiredArgsConstructor
@PreAuthorize("!hasRole('STUDENT') and !hasRole('PARENT')")
public class AssessmentSchemeController {

    private final AssessmentSchemeService service;
    private final AssessmentScheduleService assessmentScheduleService;

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

    @PostMapping("/schemes/{schemeId}/assignments")
    public ResponseEntity<AssessmentSchemeDTO> addAssignment(
            @PathVariable Integer schemeId,
            @Valid @RequestBody AssessmentSchemeAssignmentCreateDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.addAssignment(schemeId, dto));
    }

    @DeleteMapping("/schemes/{schemeId}/assignments/{assignmentId}")
    public ResponseEntity<Void> deleteAssignment(
            @PathVariable Integer schemeId,
            @PathVariable Integer assignmentId) {
        service.deleteAssignment(schemeId, assignmentId);
        return ResponseEntity.noContent().build();
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

    @GetMapping("/grading-schemes/{schemeId}")
    public ResponseEntity<GradingSchemeDTO> getGradingScheme(@PathVariable Integer schemeId) {
        return ResponseEntity.ok(service.getGradingScheme(schemeId));
    }

    @PutMapping("/grading-schemes/{schemeId}")
    public ResponseEntity<GradingSchemeDTO> updateGradingScheme(
            @PathVariable Integer schemeId,
            @Valid @RequestBody GradingSchemeCreateDTO dto) {
        return ResponseEntity.ok(service.updateGradingScheme(schemeId, dto));
    }

    @PostMapping("/grading-schemes/{schemeId}/publish")
    public ResponseEntity<GradingSchemeDTO> publishGradingScheme(@PathVariable Integer schemeId) {
        return ResponseEntity.ok(service.publishGradingScheme(schemeId));
    }

    @PostMapping("/grading-schemes/{schemeId}/archive")
    public ResponseEntity<GradingSchemeDTO> archiveGradingScheme(@PathVariable Integer schemeId) {
        return ResponseEntity.ok(service.archiveGradingScheme(schemeId));
    }

    @PostMapping("/grading-schemes/{schemeId}/clone")
    public ResponseEntity<GradingSchemeDTO> cloneGradingScheme(@PathVariable Integer schemeId) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.cloneGradingScheme(schemeId));
    }

    @PostMapping("/grading-schemes/{schemeId}/set-default")
    public ResponseEntity<GradingSchemeDTO> setDefaultGradingScheme(@PathVariable Integer schemeId) {
        return ResponseEntity.ok(service.setDefaultGradingScheme(schemeId));
    }

    // ─────────────────────────────── Assessment Scheduling ─────────────────────

    @GetMapping("/assessments")
    public ResponseEntity<List<AssessmentInstanceDTO>> listAssessments(
            @RequestParam(required = false) Integer academicYearId,
            @RequestParam(required = false) Integer classGroupId,
            @RequestParam(required = false) Integer subjectId,
            @RequestParam(required = false) Integer schemeId,
            @RequestParam(required = false) Integer componentId
    ) {
        return ResponseEntity.ok(assessmentScheduleService.listAssessments(
                academicYearId,
                classGroupId,
                subjectId,
                schemeId,
                componentId
        ));
    }

    @PostMapping("/assessments")
    public ResponseEntity<AssessmentInstanceDTO> createAssessment(@Valid @RequestBody AssessmentInstanceCreateDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(assessmentScheduleService.createAssessment(dto));
    }

    @GetMapping("/assessments/{id}")
    public ResponseEntity<AssessmentInstanceDTO> getAssessment(@PathVariable Integer id) {
        return ResponseEntity.ok(assessmentScheduleService.getAssessment(id));
    }

    @PutMapping("/assessments/{id}")
    public ResponseEntity<AssessmentInstanceDTO> updateAssessment(
            @PathVariable Integer id,
            @Valid @RequestBody AssessmentInstanceUpdateDTO dto
    ) {
        return ResponseEntity.ok(assessmentScheduleService.updateAssessment(id, dto));
    }

    @PostMapping("/assessments/{id}/cancel")
    public ResponseEntity<AssessmentInstanceDTO> cancelAssessment(@PathVariable Integer id) {
        return ResponseEntity.ok(assessmentScheduleService.cancelAssessment(id));
    }

    @PostMapping("/assessments/{id}/publish")
    public ResponseEntity<AssessmentInstanceDTO> publishAssessment(@PathVariable Integer id) {
        return ResponseEntity.ok(assessmentScheduleService.publishAssessment(id));
    }

    @PostMapping("/assessments/{id}/clone")
    public ResponseEntity<AssessmentInstanceDTO> cloneAssessment(@PathVariable Integer id) {
        return ResponseEntity.status(HttpStatus.CREATED).body(assessmentScheduleService.cloneAssessment(id));
    }

    @DeleteMapping("/assessments/{id}")
    public ResponseEntity<Void> deleteAssessment(@PathVariable Integer id) {
        assessmentScheduleService.deleteAssessment(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/assessments/{id}/open-marks")
    public ResponseEntity<AssessmentInstanceDTO> openMarksEntry(@PathVariable Integer id) {
        return ResponseEntity.ok(assessmentScheduleService.openMarksEntry(id));
    }

    @PostMapping("/assessments/{id}/lock")
    public ResponseEntity<AssessmentInstanceDTO> lockAssessment(@PathVariable Integer id) {
        return ResponseEntity.ok(assessmentScheduleService.lockAssessment(id));
    }

    @PostMapping("/schemes/{schemeId}/generate-assessments")
    public ResponseEntity<List<AssessmentInstanceDTO>> generateAssessmentsForClassScheme(
            @PathVariable Integer schemeId,
            @Valid @RequestBody AssessmentGenerateRequestDTO dto
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(assessmentScheduleService.generateAssessmentsForClassScheme(schemeId, dto));
    }

    // ─────────────────── Smart Schedule Generation ───────────────────────────

    /**
     * Generates draft exam schedule instances for ALL class-sections × subjects
     * using the published assessment scheme override hierarchy.
     * Admin only provides: academic year, schedule name, optional date window,
     * default times, room strategy, and date distribution strategy.
     */
    @PostMapping("/schedule/generate-from-schemes")
    public ResponseEntity<ExamScheduleGenerateResponseDTO> generateFromSchemes(
            @Valid @RequestBody ExamScheduleGenerateRequestDTO dto
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(assessmentScheduleService.generateFromSchemes(dto));
    }

    @PostMapping("/schedule/generate-candidates")
    public ResponseEntity<List<ScheduleCandidateDTO>> generateScheduleCandidates(
            @Valid @RequestBody ScheduleGenerateCandidatesRequestDTO dto
    ) {
        return ResponseEntity.ok(assessmentScheduleService.generateScheduleCandidates(dto));
    }

    @PostMapping("/schedule/bulk-save-drafts")
    public ResponseEntity<List<AssessmentInstanceDTO>> bulkSaveDrafts(
            @Valid @RequestBody BulkSaveDraftsRequestDTO dto
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(assessmentScheduleService.bulkSaveDrafts(dto));
    }

    /**
     * Bulk-publishes (moves to SCHEDULED) multiple DRAFT assessment instances.
     * Instances that fail validation (missing date/time/marks) are listed in the errors field.
     */
    @PostMapping("/schedule/bulk-publish")
    public ResponseEntity<AssessmentScheduleService.ExamBulkPublishResultDTO> bulkPublishAssessments(
            @Valid @RequestBody BulkPublishRequestDTO dto
    ) {
        return ResponseEntity.ok(assessmentScheduleService.bulkPublishAssessments(dto));
    }
}
