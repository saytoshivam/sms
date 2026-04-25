package com.myhaimi.sms.modules.subscription.repository;

import com.myhaimi.sms.modules.subscription.domain.SubscriptionPlanFeature;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SubscriptionPlanFeatureRepository extends JpaRepository<SubscriptionPlanFeature, SubscriptionPlanFeature.PlanFeatureKey> {

    List<SubscriptionPlanFeature> findByPlanId(Long planId);

    @Query("select pf from SubscriptionPlanFeature pf join fetch pf.feature where pf.planId = :planId")
    List<SubscriptionPlanFeature> findByPlanIdFetchFeatures(@Param("planId") Long planId);

    Optional<SubscriptionPlanFeature> findByPlanIdAndFeature_FeatureCode(Long planId, String featureCode);

    @Query(
            "select f.featureCode from SubscriptionPlanFeature pf join pf.feature f where pf.plan.id = :planId and pf.enabled = true and f.globallyEnabled = true order by f.featureCode")
    List<String> findEnabledFeatureCodesByPlanId(@Param("planId") Long planId);
}
