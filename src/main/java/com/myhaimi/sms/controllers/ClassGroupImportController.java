package com.myhaimi.sms.controllers;

import com.myhaimi.sms.DTO.classgroup.importdto.*;
import com.myhaimi.sms.service.impl.ClassGroupImportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

/**
 * Bulk class-group CSV import.
 * POST /api/class-groups/import/preview
 * POST /api/class-groups/import/commit
 * DELETE /api/class-groups/import/{token}
 */
@RestController
@RequestMapping("/api/class-groups/import")
@RequiredArgsConstructor
public class ClassGroupImportController {

    private final ClassGroupImportService importService;

    @PostMapping(value = "/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<?> preview(@RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty())
            return ResponseEntity.badRequest().body(Map.of("error", "No file uploaded."));
        try {
            return ResponseEntity.ok(importService.preview(file));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        } catch (IOException ex) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed to read file: " + ex.getMessage()));
        }
    }

    @PostMapping("/commit")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<?> commit(@RequestBody ClassGroupImportCommitDto request) {
        if (request == null || request.getImportToken() == null || request.getImportToken().isBlank())
            return ResponseEntity.badRequest().body(Map.of("error", "importToken is required."));
        try {
            return ResponseEntity.ok(importService.commit(request));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        } catch (IllegalStateException ex) {
            return ResponseEntity.unprocessableEntity().body(Map.of("error", ex.getMessage()));
        }
    }

    @DeleteMapping("/{token}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<Void> discard(@PathVariable String token) {
        importService.discard(token); return ResponseEntity.noContent().build();
    }
}

