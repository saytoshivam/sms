package com.myhaimi.sms.modules.files;

import com.myhaimi.sms.entity.FileObject;
import com.myhaimi.sms.entity.enums.FileStatus;
import com.myhaimi.sms.modules.files.storage.LocalStorageProvider;
import com.myhaimi.sms.repository.FileObjectRepo;
import com.myhaimi.sms.repository.UserRepo;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.file.Path;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Serves locally stored files through the Spring backend.
 * Only active when storage.provider=local (default for dev).
 * JWT filter runs before this — all requests must be authenticated.
 * Access control is enforced via FileAccessService.
 */
@Slf4j
@RestController
@RequestMapping("/api/files/local")
@RequiredArgsConstructor
@ConditionalOnProperty(name = "storage.provider", havingValue = "local", matchIfMissing = true)
public class FileServeController {

    private final LocalStorageProvider localStorageProvider;
    private final FileObjectRepo       fileObjectRepo;
    private final FileAccessService    fileAccessService;
    private final UserRepo             userRepo;

    /**
     * Serves a file by its storage key path segments.
     * The path variable captures the full key after /api/files/local/
     * e.g. GET /api/files/local/schools/1/STUDENT_DOCUMENT/STUDENT/5/2026/05/uuid-file.pdf
     */
    @GetMapping("/**")
    public ResponseEntity<Resource> serveFile(
            jakarta.servlet.http.HttpServletRequest request,
            Authentication auth) {

        // Extract the storage key from the URL
        String uri    = request.getRequestURI();
        String prefix = "/api/files/local/";
        int idx = uri.indexOf(prefix);
        if (idx < 0) return ResponseEntity.notFound().build();
        String storageKey = uri.substring(idx + prefix.length());

        // Tenant context must be set by the TenantFilter before we get here
        Integer schoolId = TenantContext.getSchoolId();
        if (schoolId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        // Look up by storageKey + schoolId, excluding DELETED — no findAll(), no in-memory filter
        FileObject fo = fileObjectRepo.findByStorageKeyAndSchoolIdAndStatusNot(storageKey, schoolId, FileStatus.DELETED)
                .orElse(null);
        if (fo == null) return ResponseEntity.notFound().build();

        // Access control
        try {
            FileCallerContext caller = buildCaller(auth, schoolId);
            fileAccessService.assertCanDownload(fo, caller);
        } catch (AccessDeniedException ex) {
            log.warn("Access denied serving local file {}: {}", storageKey, ex.getMessage());
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        Path filePath = localStorageProvider.resolve(storageKey);
        if (!filePath.toFile().exists()) return ResponseEntity.notFound().build();

        Resource resource = new FileSystemResource(filePath);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=\"" + fo.getOriginalFilename() + "\"")
                .contentType(MediaType.parseMediaType(fo.getContentType()))
                .body(resource);
    }

    private FileCallerContext buildCaller(Authentication auth, Integer schoolId) {
        if (auth == null || !auth.isAuthenticated()) {
            throw new AccessDeniedException("Not authenticated.");
        }
        var user = userRepo.findFirstByEmailIgnoreCase(auth.getName())
                .orElseThrow(() -> new AccessDeniedException("User not found."));
        Set<String> roles = user.getRoles().stream()
                .map(r -> r.getName()).collect(Collectors.toSet());
        Integer studentId  = user.getLinkedStudent()  != null ? user.getLinkedStudent().getId()  : null;
        Integer guardianId = user.getLinkedGuardian() != null ? user.getLinkedGuardian().getId() : null;
        return new FileCallerContext(user.getId(), roles, studentId, guardianId, schoolId);
    }
}
