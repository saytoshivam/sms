package com.myhaimi.sms.modules.platform.api;

import com.myhaimi.sms.modules.platform.api.dto.FeatureCatalogItemResponse;
import com.myhaimi.sms.modules.platform.api.dto.GloballyEnabledPatchRequest;
import com.myhaimi.sms.modules.platform.service.PlatformEntitlementAdminService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/platform/features/catalog")
@RequiredArgsConstructor
public class PlatformFeatureCatalogV1Controller {

    private final PlatformEntitlementAdminService entitlementAdminService;

    @GetMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public List<FeatureCatalogItemResponse> list() {
        return entitlementAdminService.listFeatureCatalog();
    }

    @PatchMapping("/{featureCode}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<Void> patchGlobal(
            @PathVariable String featureCode, @Valid @RequestBody GloballyEnabledPatchRequest body) {
        entitlementAdminService.setFeatureGloballyEnabled(featureCode, body.globallyEnabled());
        return ResponseEntity.noContent().build();
    }
}
