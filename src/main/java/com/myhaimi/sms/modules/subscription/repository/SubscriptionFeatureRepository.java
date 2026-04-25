package com.myhaimi.sms.modules.subscription.repository;

import com.myhaimi.sms.modules.subscription.domain.SubscriptionFeature;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SubscriptionFeatureRepository extends JpaRepository<SubscriptionFeature, Long> {
    Optional<SubscriptionFeature> findByFeatureCode(String featureCode);
}
