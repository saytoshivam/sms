package com.myhaimi.sms.modules.subscription.repository;

import com.myhaimi.sms.modules.subscription.domain.SubscriptionStatus;
import com.myhaimi.sms.modules.subscription.domain.TenantSubscription;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TenantSubscriptionRepository extends JpaRepository<TenantSubscription, Long> {

    Optional<TenantSubscription> findByTenantId(Integer tenantId);

    Optional<TenantSubscription> findByTenantIdAndStatus(Integer tenantId, SubscriptionStatus status);

    boolean existsByTenantId(Integer tenantId);

    long countByStatus(SubscriptionStatus status);
}
