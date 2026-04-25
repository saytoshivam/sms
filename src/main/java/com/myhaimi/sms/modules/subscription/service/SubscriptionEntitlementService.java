package com.myhaimi.sms.modules.subscription.service;

import com.myhaimi.sms.modules.subscription.domain.SubscriptionFeature;
import com.myhaimi.sms.modules.subscription.domain.SubscriptionStatus;
import com.myhaimi.sms.modules.subscription.repository.SubscriptionFeatureRepository;
import com.myhaimi.sms.modules.subscription.repository.SubscriptionPlanFeatureRepository;
import com.myhaimi.sms.modules.subscription.repository.TenantSubscriptionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SubscriptionEntitlementService {

    private final TenantSubscriptionRepository tenantSubscriptionRepository;
    private final SubscriptionPlanFeatureRepository planFeatureRepository;
    private final SubscriptionFeatureRepository subscriptionFeatureRepository;

    @Transactional(readOnly = true)
    public boolean isFeatureEnabledForTenant(Integer tenantId, String featureCode) {
        if (tenantId == null || featureCode == null || featureCode.isBlank()) {
            return false;
        }
        if (!isGloballyEnabled(featureCode)) {
            return false;
        }
        return tenantSubscriptionRepository
                .findByTenantIdAndStatus(tenantId, SubscriptionStatus.ACTIVE)
                .flatMap(
                        ts -> planFeatureRepository.findByPlanIdAndFeature_FeatureCode(ts.getPlan().getId(), featureCode))
                .map(pf -> Boolean.TRUE.equals(pf.getEnabled()))
                .orElse(false);
    }

    private boolean isGloballyEnabled(String featureCode) {
        return subscriptionFeatureRepository
                .findByFeatureCode(featureCode)
                .map(SubscriptionFeature::getGloballyEnabled)
                .map(Boolean.TRUE::equals)
                .orElse(false);
    }

    @Transactional(readOnly = true)
    public List<String> listEnabledFeatureCodes(Integer tenantId) {
        if (tenantId == null) {
            return Collections.emptyList();
        }
        return tenantSubscriptionRepository
                .findByTenantIdAndStatus(tenantId, SubscriptionStatus.ACTIVE)
                .map(ts -> planFeatureRepository.findEnabledFeatureCodesByPlanId(ts.getPlan().getId()))
                .orElse(Collections.emptyList());
    }
}
