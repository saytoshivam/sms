package com.myhaimi.sms.modules.files;

import com.myhaimi.sms.entity.FileObject;
import com.myhaimi.sms.entity.enums.FileStatus;
import com.myhaimi.sms.modules.files.storage.LocalStorageProvider;
import com.myhaimi.sms.repository.FileObjectRepo;
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
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.file.Path;

/**
 * Serves locally stored files through the Spring backend.
 * Only active when storage.provider=local (default for dev).
 * All requests must be authenticated — the JWT filter runs before this.
 */
@Slf4j
@RestController
@RequestMapping("/api/files/local")
@RequiredArgsConstructor
@ConditionalOnProperty(name = "storage.provider", havingValue = "local", matchIfMissing = true)
public class FileServeController {

    private final LocalStorageProvider localStorageProvider;
    private final FileObjectRepo fileObjectRepo;

    /**
     * Serves a file by its storage key path segments.
     * The path variable captures the full key after /api/files/local/
     * e.g. GET /api/files/local/schools/1/STUDENT_DOCUMENT/STUDENT/5/2026/05/uuid-file.pdf
     */
    @GetMapping("/**")
    public ResponseEntity<Resource> serveFile(jakarta.servlet.http.HttpServletRequest request) {
        // Extract everything after /api/files/local/
        String fullPath = request.getRequestURI();
        String prefix   = "/api/files/local/";
        if (!fullPath.contains(prefix)) {
            return ResponseEntity.notFound().build();
        }
        String storageKey = fullPath.substring(fullPath.indexOf(prefix) + prefix.length());

        // Security: verify a FileObject row exists for this key in the current school
        Integer schoolId = TenantContext.getSchoolId();
        if (schoolId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        // Find by storageKey — simple linear scan is acceptable since this is dev-only
        var fo = fileObjectRepo.findAll().stream()
                .filter(f -> storageKey.equals(f.getStorageKey())
                        && schoolId.equals(f.getSchoolId())
                        && f.getStatus() != FileStatus.DELETED)
                .findFirst()
                .orElse(null);

        if (fo == null) return ResponseEntity.notFound().build();

        Path filePath = localStorageProvider.resolve(storageKey);
        if (!filePath.toFile().exists()) return ResponseEntity.notFound().build();

        Resource resource = new FileSystemResource(filePath);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=\"" + fo.getOriginalFilename() + "\"")
                .contentType(MediaType.parseMediaType(fo.getContentType()))
                .body(resource);
    }
}

