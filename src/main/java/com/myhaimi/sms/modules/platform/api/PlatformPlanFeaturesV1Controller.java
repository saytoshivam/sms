package com.myhaimi.sms.modules.platform.api;

import com.myhaimi.sms.modules.platform.api.dto.PlanFeatureRowResponse;
import com.myhaimi.sms.modules.platform.api.dto.PlanFeatureToggleRequest;
import com.myhaimi.sms.modules.platform.service.PlatformEntitlementAdminService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/platform/plans")
@RequiredArgsConstructor
public class PlatformPlanFeaturesV1Controller {

    private final PlatformEntitlementAdminService entitlementAdminService;

    @GetMapping("/{planCode}/features")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public List<PlanFeatureRowResponse> listForPlan(@PathVariable String planCode) {
        return entitlementAdminService.listPlanFeatures(planCode);
    }

    @PutMapping("/{planCode}/features/{featureCode}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<Void> toggle(
            @PathVariable String planCode,
            @PathVariable String featureCode,
            @Valid @RequestBody PlanFeatureToggleRequest body) {
        entitlementAdminService.setPlanFeatureEnabled(planCode, featureCode, body.enabled());
        return ResponseEntity.noContent().build();
    }
}
