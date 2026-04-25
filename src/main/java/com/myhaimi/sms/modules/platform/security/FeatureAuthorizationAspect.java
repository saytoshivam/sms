package com.myhaimi.sms.modules.platform.security;

import com.myhaimi.sms.modules.subscription.service.SubscriptionEntitlementService;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Before;
import org.springframework.core.annotation.Order;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Aspect
@Component
@Order(50)
@RequiredArgsConstructor
public class FeatureAuthorizationAspect {

    private final SubscriptionEntitlementService subscriptionEntitlementService;

    @Before("@annotation(requireFeature)")
    public void enforceFeature(RequireFeature requireFeature) {
        String code = requireFeature.value();
        Integer tenantId = TenantContext.getTenantId();

        if (tenantId == null && isSuperAdmin()) {
            return;
        }
        if (tenantId == null) {
            throw new FeatureAccessDeniedException("Tenant context is required for feature: " + code);
        }
        if (!subscriptionEntitlementService.isFeatureEnabledForTenant(tenantId, code)) {
            throw new FeatureAccessDeniedException("This feature is not included in your school's plan: " + code);
        }
    }

    private static boolean isSuperAdmin() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) {
            return false;
        }
        for (GrantedAuthority a : auth.getAuthorities()) {
            if ("ROLE_SUPER_ADMIN".equals(a.getAuthority())) {
                return true;
            }
        }
        return false;
    }
}
