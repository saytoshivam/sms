package com.myhaimi.sms.controllers;

import com.myhaimi.sms.DTO.student.importdto.StudentImportCommitDto;
import com.myhaimi.sms.DTO.student.importdto.StudentImportCommitResultDto;
import com.myhaimi.sms.DTO.student.importdto.StudentImportPreviewDto;
import com.myhaimi.sms.service.impl.StudentImportService;
import com.myhaimi.sms.utils.CsvImportParser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

/**
 * Endpoints for the bulk CSV student import flow.
 *
 * <pre>
 * POST /api/students/import/preview  (multipart/form-data, field = "file")
 *   → Parse, validate, return preview + importToken. Nothing is persisted.
 *
 * POST /api/students/import/commit   (application/json)
 *   → Persist valid rows using the token from the preview response.
 *
 * DELETE /api/students/import/{token}
 *   → Discard a preview session (user cancelled).
 * </pre>
 */
@RestController
@RequestMapping("/api/students/import")
@RequiredArgsConstructor
public class StudentImportController {

    private final StudentImportService importService;

    /**
     * Step 1 – Parse + validate.
     *
     * @param file Uploaded CSV (content-type text/csv or application/octet-stream)
     */
    @PostMapping(value = "/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> preview(@RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "No file uploaded. Send a CSV as form-data field 'file'."));
        }

        String contentType = file.getContentType();
        if (contentType != null
                && !contentType.startsWith("text/")
                && !contentType.equals("application/octet-stream")
                && !contentType.equals("application/vnd.ms-excel")) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Unsupported file type '" + contentType + "'. Upload a .csv file."));
        }

        try {
            StudentImportPreviewDto preview = importService.preview(file);
            return ResponseEntity.ok(preview);
        } catch (CsvImportParser.CsvParseException | IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        } catch (IOException ex) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to read uploaded file: " + ex.getMessage()));
        }
    }

    /**
     * Step 2 – Commit.
     *
     * @param request Contains the importToken from preview and optional strictMode flag.
     */
    @PostMapping("/commit")
    public ResponseEntity<?> commit(@RequestBody StudentImportCommitDto request) {
        if (request == null || request.getImportToken() == null || request.getImportToken().isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "importToken is required. Call /preview first."));
        }
        try {
            StudentImportCommitResultDto result = importService.commit(request);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        } catch (IllegalStateException ex) {
            // strict-mode failure
            return ResponseEntity.unprocessableEntity().body(Map.of("error", ex.getMessage()));
        }
    }

    /**
     * Cancel – discard a preview session without importing.
     */
    @DeleteMapping("/{token}")
    public ResponseEntity<Void> discard(@PathVariable String token) {
        importService.discard(token);
        return ResponseEntity.noContent().build();
    }
}
