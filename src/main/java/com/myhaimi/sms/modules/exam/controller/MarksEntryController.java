package com.myhaimi.sms.modules.exam.controller;

import com.myhaimi.sms.modules.exam.dto.MarksEntryBulkSaveDTO;
import com.myhaimi.sms.modules.exam.dto.MarksEntrySheetDTO;
import com.myhaimi.sms.modules.exam.service.MarksEntryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * Marks Entry APIs.
 *
 * <pre>
 * GET  /api/exams/assessments/{id}/marks-sheet
 * POST /api/exams/assessments/{id}/marks/draft
 * POST /api/exams/assessments/{id}/marks/submit
 * POST /api/exams/assessments/{id}/marks/lock
 * POST /api/exams/assessments/{id}/marks/reopen  (admin only)
 * </pre>
 */
@RestController
@RequestMapping("/api/exams/assessments/{id}")
@RequiredArgsConstructor
@PreAuthorize("!hasRole('STUDENT') and !hasRole('PARENT')")
public class MarksEntryController {

    private final MarksEntryService marksEntryService;

    @GetMapping("/marks-sheet")
    public ResponseEntity<MarksEntrySheetDTO> getMarksSheet(@PathVariable Integer id) {
        return ResponseEntity.ok(marksEntryService.getMarksEntrySheet(id));
    }

    @PostMapping("/marks/draft")
    public ResponseEntity<MarksEntrySheetDTO> saveDraft(
            @PathVariable Integer id,
            @Valid @RequestBody MarksEntryBulkSaveDTO dto
    ) {
        return ResponseEntity.ok(marksEntryService.saveDraftMarks(id, dto));
    }

    @PostMapping("/marks/submit")
    public ResponseEntity<MarksEntrySheetDTO> submitMarks(
            @PathVariable Integer id,
            @Valid @RequestBody MarksEntryBulkSaveDTO dto
    ) {
        return ResponseEntity.ok(marksEntryService.submitMarks(id, dto));
    }

    @PostMapping("/marks/lock")
    public ResponseEntity<MarksEntrySheetDTO> lockMarks(@PathVariable Integer id) {
        return ResponseEntity.ok(marksEntryService.lockMarks(id));
    }

    @PostMapping("/marks/reopen")
    @PreAuthorize("hasRole('ADMIN') or hasRole('PRINCIPAL')")
    public ResponseEntity<MarksEntrySheetDTO> reopenMarks(@PathVariable Integer id) {
        return ResponseEntity.ok(marksEntryService.reopenMarks(id));
    }
}

