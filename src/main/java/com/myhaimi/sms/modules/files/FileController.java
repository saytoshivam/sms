package com.myhaimi.sms.modules.files;

import com.myhaimi.sms.entity.enums.FileCategory;
import com.myhaimi.sms.entity.enums.FileVisibility;
import com.myhaimi.sms.security.RoleNames;
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
 * POST   /api/files/upload              — upload any file
 * GET    /api/files/{id}/download-url   — get signed/temporary read URL
 * GET    /api/files/{id}                — file metadata only
 * DELETE /api/files/{id}                — soft delete
 */
@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class FileController {

    private final FileService fileService;
    private final UserRepo userRepo;

    // ── exception handler ─────────────────────────────────────────────────────
    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<Map<String, String>> handleAccessDenied(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", ex.getMessage()));
    }

    // ── upload ────────────────────────────────────────────────────────────────

    /**
     * Generic upload endpoint.
     *
     * @param file       Multipart file
     * @param category   FileCategory enum name (e.g. STUDENT_DOCUMENT, PROFILE_PHOTO)
     * @param ownerType  Domain entity type (e.g. STUDENT, TEACHER)
     * @param ownerId    PK of the owning entity
     * @param visibility FileVisibility enum name (default: SCHOOL_INTERNAL)
     */
    @PostMapping("/upload")
    public ResponseEntity<?> upload(
            @RequestParam("file")                  MultipartFile file,
            @RequestParam("category")              String category,
            @RequestParam("ownerType")             String ownerType,
            @RequestParam("ownerId")               String ownerId,
            @RequestParam(value = "visibility",
                    defaultValue = "SCHOOL_INTERNAL") String visibility,
            Authentication auth) {
        try {
            FileCategory fileCat = FileCategory.valueOf(category.toUpperCase());
            FileVisibility vis    = FileVisibility.valueOf(visibility.toUpperCase());
            Integer callerUserId  = resolveUserId(auth);

            FileObjectDTO result = fileService.upload(file, fileCat, ownerType, ownerId, vis, callerUserId);
            return ResponseEntity.status(HttpStatus.CREATED).body(result);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    // ── download-url ──────────────────────────────────────────────────────────

    @GetMapping("/{fileId}/download-url")
    public ResponseEntity<?> downloadUrl(@PathVariable Long fileId, Authentication auth) {
        try {
            CallerInfo caller = resolveCallerInfo(auth);
            FileObjectDTO result = fileService.getDownloadUrl(
                    fileId, caller.userId(), caller.roles(),
                    caller.linkedStudentId(), caller.linkedGuardianId());
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", ex.getMessage()));
        } catch (AccessDeniedException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", ex.getMessage()));
        }
    }

    // ── metadata ──────────────────────────────────────────────────────────────

    @GetMapping("/{fileId}")
    public ResponseEntity<?> metadata(@PathVariable Long fileId) {
        try {
            return ResponseEntity.ok(fileService.getMetadata(fileId));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", ex.getMessage()));
        }
    }

    // ── soft delete ───────────────────────────────────────────────────────────

    @DeleteMapping("/{fileId}")
    public ResponseEntity<?> delete(@PathVariable Long fileId, Authentication auth) {
        try {
            Integer callerUserId = resolveUserId(auth);
            fileService.softDelete(fileId, callerUserId);
            return ResponseEntity.ok(Map.of("message", "File deleted."));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", ex.getMessage()));
        }
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private Integer resolveUserId(Authentication auth) {
        if (auth == null) return null;
        return userRepo.findFirstByEmailIgnoreCase(auth.getName())
                .map(u -> u.getId())
                .orElse(null);
    }

    private CallerInfo resolveCallerInfo(Authentication auth) {
        if (auth == null) throw new AccessDeniedException("Not authenticated.");
        var user = userRepo.findFirstByEmailIgnoreCase(auth.getName())
                .orElseThrow(() -> new AccessDeniedException("User not found."));
        Set<String> roles = user.getRoles().stream()
                .map(r -> r.getName())
                .collect(Collectors.toSet());
        Integer studentId  = user.getLinkedStudent()  != null ? user.getLinkedStudent().getId()  : null;
        Integer guardianId = user.getLinkedGuardian() != null ? user.getLinkedGuardian().getId() : null;
        return new CallerInfo(user.getId(), roles, studentId, guardianId);
    }

    record CallerInfo(Integer userId, Set<String> roles, Integer linkedStudentId, Integer linkedGuardianId) {}
}

