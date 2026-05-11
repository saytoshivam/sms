package com.myhaimi.sms.controllers;

import com.myhaimi.sms.DTO.staff.importdto.StaffImportCommitDto;
import com.myhaimi.sms.DTO.staff.importdto.StaffImportCommitResultDto;
import com.myhaimi.sms.DTO.staff.importdto.StaffImportPreviewDto;
import com.myhaimi.sms.service.impl.StaffImportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

/**
 * Bulk staff CSV import.
 *
 * <pre>
 * POST /api/staff/import/preview   (multipart/form-data, field = "file")
 *   → Parse, validate, return preview + importToken. Nothing is persisted.
 *
 * POST /api/staff/import/commit    (application/json)
 *   → Persist valid rows from the preview session.
 *
 * DELETE /api/staff/import/{token}
 *   → Discard a preview session (user cancelled).
 * </pre>
 */
@RestController
@RequestMapping("/api/staff/import")
@RequiredArgsConstructor
public class StaffImportController {

    private final StaffImportService importService;

    /**
     * Step 1 – Parse + validate.
     */
    @PostMapping(value = "/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<?> preview(@RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty())
            return ResponseEntity.badRequest().body(Map.of("error", "No file uploaded. Send a CSV as form-data field 'file'."));

        String ct = file.getContentType();
        if (ct != null && !ct.startsWith("text/") && !ct.equals("application/octet-stream") && !ct.equals("application/vnd.ms-excel"))
            return ResponseEntity.badRequest().body(Map.of("error", "Unsupported file type '" + ct + "'. Upload a .csv file."));

        try {
            StaffImportPreviewDto preview = importService.preview(file);
            return ResponseEntity.ok(preview);
        } catch (StaffImportService.CsvParseException | IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        } catch (IOException ex) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed to read uploaded file: " + ex.getMessage()));
        }
    }

    /**
     * Step 2 – Commit.
     */
    @PostMapping("/commit")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<?> commit(@RequestBody StaffImportCommitDto request) {
        if (request == null || request.getImportToken() == null || request.getImportToken().isBlank())
            return ResponseEntity.badRequest().body(Map.of("error", "importToken is required. Call /preview first."));
        try {
            StaffImportCommitResultDto result = importService.commit(request);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        } catch (IllegalStateException ex) {
            return ResponseEntity.unprocessableEntity().body(Map.of("error", ex.getMessage()));
        }
    }

    /**
     * Cancel – discard a preview session.
     */
    @DeleteMapping("/{token}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<Void> discard(@PathVariable String token) {
        importService.discard(token);
        return ResponseEntity.noContent().build();
    }
}

