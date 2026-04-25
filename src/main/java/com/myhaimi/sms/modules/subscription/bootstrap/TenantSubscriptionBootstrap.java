package com.myhaimi.sms.modules.subscription.bootstrap;

import com.myhaimi.sms.entity.School;
import com.myhaimi.sms.modules.subscription.domain.SubscriptionStatus;
import com.myhaimi.sms.modules.subscription.domain.SubscriptionPlan;
import com.myhaimi.sms.modules.subscription.domain.TenantSubscription;
import com.myhaimi.sms.modules.subscription.repository.SubscriptionPlanRepository;
import com.myhaimi.sms.modules.subscription.repository.TenantSubscriptionRepository;
import com.myhaimi.sms.repository.SchoolRepo;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * Ensures every school has an active subscription row (defaults to BASIC).
 */
@Component
@Order(5000)
@RequiredArgsConstructor
@Slf4j
public class TenantSubscriptionBootstrap implements CommandLineRunner {

    private final SchoolRepo schoolRepo;
    private final SubscriptionPlanRepository subscriptionPlanRepository;
    private final TenantSubscriptionRepository tenantSubscriptionRepository;

    @Override
    @Transactional
    public void run(String... args) {
        SubscriptionPlan basic = subscriptionPlanRepository
                .findByPlanCodeIgnoreCase("BASIC")
                .orElse(null);
        if (basic == null) {
            log.warn("BASIC plan missing; skip tenant subscription bootstrap.");
            return;
        }
        for (School school : schoolRepo.findAll()) {
            if (!tenantSubscriptionRepository.existsByTenantId(school.getId())) {
                TenantSubscription ts = new TenantSubscription();
                ts.setTenantId(school.getId());
                ts.setPlan(basic);
                ts.setStatus(SubscriptionStatus.ACTIVE);
                ts.setStartsAt(Instant.now());
                tenantSubscriptionRepository.save(ts);
                log.info("Assigned BASIC subscription to tenant {}", school.getId());
            }
        }
    }
}
