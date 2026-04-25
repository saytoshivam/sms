package com.myhaimi.sms.modules.platform.service;

import com.myhaimi.sms.modules.platform.api.dto.FeatureCatalogItemResponse;
import com.myhaimi.sms.modules.platform.api.dto.PlanFeatureRowResponse;
import com.myhaimi.sms.modules.subscription.domain.SubscriptionFeature;
import com.myhaimi.sms.modules.subscription.domain.SubscriptionPlan;
import com.myhaimi.sms.modules.subscription.domain.SubscriptionPlanFeature;
import com.myhaimi.sms.modules.subscription.repository.SubscriptionFeatureRepository;
import com.myhaimi.sms.modules.subscription.repository.SubscriptionPlanFeatureRepository;
import com.myhaimi.sms.modules.subscription.repository.SubscriptionPlanRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class PlatformEntitlementAdminService {

    private final SubscriptionFeatureRepository featureRepository;
    private final SubscriptionPlanRepository planRepository;
    private final SubscriptionPlanFeatureRepository planFeatureRepository;
    private final PlatformAuditService auditService;

    @Transactional(readOnly = true)
    public List<FeatureCatalogItemResponse> listFeatureCatalog() {
        return featureRepository.findAll(Sort.by(Sort.Direction.ASC, "featureCode")).stream()
                .map(f -> new FeatureCatalogItemResponse(
                        f.getFeatureCode(),
                        f.getName(),
                        Boolean.TRUE.equals(f.getGloballyEnabled())))
                .toList();
    }

    @Transactional
    public void setFeatureGloballyEnabled(String featureCode, boolean globallyEnabled) {
        SubscriptionFeature f = featureRepository.findByFeatureCode(featureCode).orElseThrow();
        f.setGloballyEnabled(globallyEnabled);
        featureRepository.save(f);
        auditService.record(
                "FEATURE_GLOBAL_TOGGLE",
                "SubscriptionFeature",
                featureCode,
                Boolean.toString(globallyEnabled));
    }

    @Transactional(readOnly = true)
    public List<PlanFeatureRowResponse> listPlanFeatures(String planCode) {
        SubscriptionPlan plan = planRepository.findByPlanCodeIgnoreCase(planCode).orElseThrow();
        Map<String, Boolean> enabledByCode = new HashMap<>();
        for (SubscriptionPlanFeature pf : planFeatureRepository.findByPlanIdFetchFeatures(plan.getId())) {
            enabledByCode.put(pf.getFeature().getFeatureCode(), Boolean.TRUE.equals(pf.getEnabled()));
        }
        return featureRepository.findAll(Sort.by(Sort.Direction.ASC, "featureCode")).stream()
                .map(f -> new PlanFeatureRowResponse(
                        f.getFeatureCode(), f.getName(), enabledByCode.getOrDefault(f.getFeatureCode(), false)))
                .toList();
    }

    @Transactional
    public void setPlanFeatureEnabled(String planCode, String featureCode, boolean enabled) {
        SubscriptionPlan plan = planRepository.findByPlanCodeIgnoreCase(planCode).orElseThrow();
        SubscriptionFeature feature = featureRepository.findByFeatureCode(featureCode).orElseThrow();
        SubscriptionPlanFeature link = planFeatureRepository
                .findByPlanIdAndFeature_FeatureCode(plan.getId(), featureCode)
                .orElseGet(() -> {
                    SubscriptionPlanFeature n = new SubscriptionPlanFeature();
                    n.setPlanId(plan.getId());
                    n.setFeatureId(feature.getId());
                    return n;
                });
        link.setEnabled(enabled);
        planFeatureRepository.save(link);
        auditService.record(
                "PLAN_FEATURE_TOGGLE",
                "SubscriptionPlanFeature",
                planCode + ":" + featureCode,
                Boolean.toString(enabled));
    }
}
