package com.myhaimi.sms.modules.platform.api;

import com.myhaimi.sms.modules.platform.api.dto.PlatformAnnouncementResponse;
import com.myhaimi.sms.modules.platform.api.dto.PlatformAnnouncementWriteRequest;
import com.myhaimi.sms.modules.platform.service.PlatformAnnouncementAdminService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/platform/announcements")
@RequiredArgsConstructor
public class PlatformAnnouncementAdminV1Controller {

    private final PlatformAnnouncementAdminService announcementAdminService;

    @GetMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public List<PlatformAnnouncementResponse> list() {
        return announcementAdminService.listAll();
    }

    @PostMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public PlatformAnnouncementResponse create(@Valid @RequestBody PlatformAnnouncementWriteRequest body) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return announcementAdminService.create(body, email);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public PlatformAnnouncementResponse update(
            @PathVariable long id, @Valid @RequestBody PlatformAnnouncementWriteRequest body) {
        return announcementAdminService.update(id, body);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable long id) {
        announcementAdminService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
