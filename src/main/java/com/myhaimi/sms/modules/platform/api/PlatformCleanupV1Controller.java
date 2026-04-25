package com.myhaimi.sms.modules.platform.api;

import com.myhaimi.sms.modules.platform.service.PlatformCleanupService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/platform/cleanup")
@RequiredArgsConstructor
public class PlatformCleanupV1Controller {

    private final PlatformCleanupService platformCleanupService;

    @PostMapping("/purge-soft-deleted")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<PurgeResult> purgeSoftDeleted() {
        return ResponseEntity.ok(platformCleanupService.purgeSoftDeleted());
    }

    public record PurgeResult(int subjectsPurged, int roomsPurged, int classGroupsPurged, int skipped) {}
}

