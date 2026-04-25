package com.myhaimi.sms.modules.subscription.repository;

import com.myhaimi.sms.modules.subscription.domain.SubscriptionPlan;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SubscriptionPlanRepository extends JpaRepository<SubscriptionPlan, Long> {
    Optional<SubscriptionPlan> findByPlanCodeIgnoreCase(String planCode);

    List<SubscriptionPlan> findByActiveTrueOrderByNameAsc();
}
