package com.myhaimi.sms.controllers;

import com.myhaimi.sms.DTO.subject.importdto.SubjectImportCommitDto;
import com.myhaimi.sms.DTO.subject.importdto.SubjectImportCommitResultDto;
import com.myhaimi.sms.DTO.subject.importdto.SubjectImportPreviewDto;
import com.myhaimi.sms.service.impl.SubjectImportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

/**
 * Bulk subject CSV import.
 *
 * POST /api/subjects/import/preview   (multipart/form-data, field = "file")
 * POST /api/subjects/import/commit    (application/json)
 * DELETE /api/subjects/import/{token}
 */
@RestController
@RequestMapping("/api/subjects/import")
@RequiredArgsConstructor
public class SubjectImportController {

    private final SubjectImportService importService;

    @PostMapping(value = "/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<?> preview(@RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty())
            return ResponseEntity.badRequest().body(Map.of("error", "No file uploaded. Send a CSV as form-data field 'file'."));
        try {
            SubjectImportPreviewDto preview = importService.preview(file);
            return ResponseEntity.ok(preview);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        } catch (IOException ex) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed to read uploaded file: " + ex.getMessage()));
        }
    }

    @PostMapping("/commit")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<?> commit(@RequestBody SubjectImportCommitDto request) {
        if (request == null || request.getImportToken() == null || request.getImportToken().isBlank())
            return ResponseEntity.badRequest().body(Map.of("error", "importToken is required."));
        try {
            SubjectImportCommitResultDto result = importService.commit(request);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        } catch (IllegalStateException ex) {
            return ResponseEntity.unprocessableEntity().body(Map.of("error", ex.getMessage()));
        }
    }

    @DeleteMapping("/{token}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<Void> discard(@PathVariable String token) {
        importService.discard(token);
        return ResponseEntity.noContent().build();
    }
}

