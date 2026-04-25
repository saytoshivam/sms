package com.myhaimi.sms.modules.tenant.api;

import com.myhaimi.sms.modules.platform.api.dto.TenantFeaturesResponse;
import com.myhaimi.sms.modules.subscription.service.SubscriptionEntitlementService;
import com.myhaimi.sms.modules.tenant.api.dto.TenantCapabilitiesResponse;
import com.myhaimi.sms.service.impl.EffectiveTenantPermissionService;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/tenant")
@RequiredArgsConstructor
public class TenantFeaturesV1Controller {

    private final SubscriptionEntitlementService subscriptionEntitlementService;
    private final EffectiveTenantPermissionService effectiveTenantPermissionService;

    @GetMapping("/features")
    public ResponseEntity<TenantFeaturesResponse> features() {
        Integer tenantId = TenantContext.getTenantId();
        if (tenantId == null) {
            return ResponseEntity.ok(new TenantFeaturesResponse(List.of()));
        }
        return ResponseEntity.ok(new TenantFeaturesResponse(subscriptionEntitlementService.listEnabledFeatureCodes(tenantId)));
    }

    /**
     * Role-derived permissions plus the subset that remains effective for the tenant's subscription (feature +
     * permission model).
     */
    @GetMapping("/capabilities")
    public ResponseEntity<TenantCapabilitiesResponse> capabilities(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.ok(new TenantCapabilitiesResponse(List.of(), List.of(), List.of()));
        }
        Integer tenantId = TenantContext.getTenantId();
        return ResponseEntity.ok(
                effectiveTenantPermissionService.capabilities(authentication.getName(), tenantId));
    }
}
