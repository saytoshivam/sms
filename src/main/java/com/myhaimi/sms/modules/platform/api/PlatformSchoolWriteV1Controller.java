package com.myhaimi.sms.modules.platform.api;

import com.myhaimi.sms.modules.platform.api.dto.PlatformSchoolListItem;
import com.myhaimi.sms.modules.platform.api.dto.PlatformSchoolUpdateRequest;
import com.myhaimi.sms.modules.subscription.service.PlatformSchoolAdminService;
import com.myhaimi.sms.modules.platform.service.PlatformSchoolWriteService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/platform/schools")
@RequiredArgsConstructor
public class PlatformSchoolWriteV1Controller {

    private final PlatformSchoolAdminService platformSchoolAdminService;
    private final PlatformSchoolWriteService platformSchoolWriteService;

    @GetMapping("/{schoolId}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public PlatformSchoolListItem getOne(@PathVariable int schoolId) {
        return platformSchoolAdminService.getSchoolRow(schoolId);
    }

    @PutMapping("/{schoolId}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<PlatformSchoolListItem> update(
            @PathVariable int schoolId, @Valid @RequestBody PlatformSchoolUpdateRequest body) {
        platformSchoolWriteService.update(schoolId, body);
        return ResponseEntity.ok(platformSchoolAdminService.getSchoolRow(schoolId));
    }

    @DeleteMapping("/{schoolId}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<Void> archive(@PathVariable int schoolId) {
        platformSchoolWriteService.archive(schoolId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{schoolId}/restore")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<Void> restore(@PathVariable int schoolId) {
        platformSchoolWriteService.restore(schoolId);
        return ResponseEntity.noContent().build();
    }
}
