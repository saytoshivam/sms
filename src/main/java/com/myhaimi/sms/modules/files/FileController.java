package com.myhaimi.sms.modules.files;

import com.myhaimi.sms.entity.enums.FileCategory;
import com.myhaimi.sms.entity.enums.FileVisibility;
import com.myhaimi.sms.repository.UserRepo;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * REST endpoints for the centralised file module.
 *
 * POST   /api/files/upload              — generic upload (SCHOOL_ADMIN / PRINCIPAL only)
 * GET    /api/files/{id}/download-url   — permission-checked signed URL
 * GET    /api/files/{id}                — permission-checked metadata
 * DELETE /api/files/{id}                — permission-checked soft delete
 */
@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class FileController {

    private final FileService       fileService;
    private final FileAccessService fileAccessService;
    private final UserRepo          userRepo;

    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<Map<String, String>> handleAccessDenied(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", ex.getMessage()));
    }

    // ── generic upload (admin-only) ───────────────────────────────────────────

    @PostMapping("/upload")
    public ResponseEntity<?> upload(
            @RequestParam("file")                                  MultipartFile file,
            @RequestParam("category")                              String category,
            @RequestParam("ownerType")                             String ownerType,
            @RequestParam("ownerId")                               String ownerId,
            @RequestParam(value = "visibility", defaultValue = "SCHOOL_INTERNAL") String visibility,
            Authentication auth) {
        try {
            FileCallerContext caller = resolveCallerContext(auth);
            fileAccessService.assertCanUploadGeneric(caller);

            FileCategory   fileCat = FileCategory.valueOf(category.toUpperCase());
            FileVisibility vis     = FileVisibility.valueOf(visibility.toUpperCase());

            FileObjectDTO result = fileService.upload(file, fileCat, ownerType, ownerId, vis, caller.userId());
            return ResponseEntity.status(HttpStatus.CREATED).body(result);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    // ── download URL ──────────────────────────────────────────────────────────

    @GetMapping("/{fileId}/download-url")
    public ResponseEntity<?> downloadUrl(@PathVariable Long fileId, Authentication auth) {
        try {
            FileCallerContext caller = resolveCallerContext(auth);
            return ResponseEntity.ok(fileService.getDownloadUrl(fileId, caller));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", ex.getMessage()));
        } catch (AccessDeniedException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", ex.getMessage()));
        }
    }

    // ── metadata ──────────────────────────────────────────────────────────────

    @GetMapping("/{fileId}")
    public ResponseEntity<?> metadata(@PathVariable Long fileId, Authentication auth) {
        try {
            FileCallerContext caller = resolveCallerContext(auth);
            return ResponseEntity.ok(fileService.getMetadata(fileId, caller));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", ex.getMessage()));
        } catch (AccessDeniedException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", ex.getMessage()));
        }
    }

    // ── soft delete ───────────────────────────────────────────────────────────

    @DeleteMapping("/{fileId}")
    public ResponseEntity<?> delete(@PathVariable Long fileId, Authentication auth) {
        try {
            FileCallerContext caller = resolveCallerContext(auth);
            fileService.softDelete(fileId, caller);
            return ResponseEntity.ok(Map.of("message", "File deleted."));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", ex.getMessage()));
        } catch (AccessDeniedException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", ex.getMessage()));
        }
    }

    // ── resolver ─────────────────────────────────────────────────────────────

    FileCallerContext resolveCallerContext(Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) {
            throw new AccessDeniedException("Not authenticated.");
        }
        var user = userRepo.findFirstByEmailIgnoreCase(auth.getName())
                .orElseThrow(() -> new AccessDeniedException("User account not found."));

        Set<String> roles = user.getRoles().stream()
                .map(r -> r.getName())
                .collect(Collectors.toSet());

        Integer studentId  = user.getLinkedStudent()  != null ? user.getLinkedStudent().getId()  : null;
        Integer guardianId = user.getLinkedGuardian() != null ? user.getLinkedGuardian().getId() : null;
        Integer schoolId   = user.getSchool()         != null ? user.getSchool().getId()          : null;

        return new FileCallerContext(user.getId(), roles, studentId, guardianId, schoolId);
    }
}
