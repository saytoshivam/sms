package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.entity.Role;
import com.myhaimi.sms.entity.User;
import com.myhaimi.sms.modules.subscription.service.SubscriptionEntitlementService;
import com.myhaimi.sms.modules.tenant.api.dto.TenantCapabilitiesResponse;
import com.myhaimi.sms.repository.UserRepo;
import com.myhaimi.sms.security.PermissionFeatureGates;
import com.myhaimi.sms.security.RolePermissionCatalog;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;

@Service
@RequiredArgsConstructor
public class EffectiveTenantPermissionService {

    private final UserRepo userRepo;
    private final SubscriptionEntitlementService subscriptionEntitlementService;

    /**
     * Permissions granted by role union ({@code permissionsGranted}) and the subset still effective when the tenant's
     * subscription includes required features ({@code permissionsEffective}).
     */
    @Transactional(readOnly = true)
    public TenantCapabilitiesResponse capabilities(String actorEmail, Integer tenantId) {
        User user = userRepo.findFirstByEmailIgnoreCase(actorEmail.trim()).orElseThrow();
        Set<String> granted = new TreeSet<>();
        for (Role r : user.getRoles()) {
            granted.addAll(RolePermissionCatalog.forRoleName(r.getName()));
        }
        List<String> featureCodes =
                tenantId == null ? List.of() : subscriptionEntitlementService.listEnabledFeatureCodes(tenantId);
        Set<String> enabled = new HashSet<>(featureCodes);

        Set<String> effective = new TreeSet<>();
        for (String p : granted) {
            String gate = PermissionFeatureGates.requiredFeature(p);
            if (gate == null || enabled.contains(gate)) {
                effective.add(p);
            }
        }

        return new TenantCapabilitiesResponse(
                featureCodes,
                List.copyOf(granted),
                List.copyOf(effective));
    }
}
