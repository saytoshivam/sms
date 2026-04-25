package com.myhaimi.sms.modules.platform.api;

import com.myhaimi.sms.modules.platform.api.dto.PlatformFeatureFlagResponse;
import com.myhaimi.sms.modules.platform.api.dto.PlatformFeatureFlagUpdateRequest;
import com.myhaimi.sms.modules.platform.service.PlatformFeatureFlagAdminService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/platform/flags")
@RequiredArgsConstructor
public class PlatformFeatureFlagsV1Controller {

    private final PlatformFeatureFlagAdminService platformFeatureFlagAdminService;

    @GetMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public List<PlatformFeatureFlagResponse> list() {
        return platformFeatureFlagAdminService.list();
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public PlatformFeatureFlagResponse patch(@PathVariable long id, @Valid @RequestBody PlatformFeatureFlagUpdateRequest body) {
        return platformFeatureFlagAdminService.update(id, body);
    }
}
