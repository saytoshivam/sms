package com.myhaimi.sms.modules.subscription.api;

import com.myhaimi.sms.modules.platform.api.dto.AssignTenantPlanRequest;
import com.myhaimi.sms.modules.platform.api.dto.SubscriptionPlanResponse;
import com.myhaimi.sms.modules.platform.api.dto.TenantSubscriptionStatusPatchRequest;
import com.myhaimi.sms.modules.platform.service.PlatformAuditService;
import com.myhaimi.sms.modules.subscription.domain.SubscriptionPlan;
import com.myhaimi.sms.modules.subscription.domain.SubscriptionStatus;
import com.myhaimi.sms.modules.subscription.domain.TenantSubscription;
import com.myhaimi.sms.modules.subscription.repository.SubscriptionPlanRepository;
import com.myhaimi.sms.modules.subscription.repository.TenantSubscriptionRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/v1/platform")
@RequiredArgsConstructor
public class PlatformPlanV1Controller {

    private final SubscriptionPlanRepository subscriptionPlanRepository;
    private final TenantSubscriptionRepository tenantSubscriptionRepository;
    private final PlatformAuditService platformAuditService;

    @GetMapping("/plans")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public List<SubscriptionPlanResponse> listPlans() {
        return subscriptionPlanRepository.findAll().stream().map(PlatformPlanV1Controller::toDto).toList();
    }

    @PutMapping("/tenants/{tenantId}/subscription")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @Transactional
    public ResponseEntity<SubscriptionPlanResponse> assignPlan(
            @PathVariable int tenantId, @Valid @RequestBody AssignTenantPlanRequest body) {
        SubscriptionPlan plan = subscriptionPlanRepository
                .findByPlanCodeIgnoreCase(body.planCode())
                .orElseThrow(() -> new IllegalArgumentException("Unknown plan: " + body.planCode()));
        TenantSubscription sub =
                tenantSubscriptionRepository.findByTenantId(tenantId).orElseGet(TenantSubscription::new);
        sub.setTenantId(tenantId);
        sub.setPlan(plan);
        sub.setStatus(SubscriptionStatus.ACTIVE);
        sub.setStartsAt(Instant.now());
        sub.setEndsAt(null);
        tenantSubscriptionRepository.save(sub);
        platformAuditService.record(
                "TENANT_PLAN_ASSIGN",
                "TenantSubscription",
                String.valueOf(tenantId),
                plan.getPlanCode());
        return ResponseEntity.ok(toDto(plan));
    }

    @PatchMapping("/tenants/{tenantId}/subscription/status")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @Transactional
    public ResponseEntity<Void> patchSubscriptionStatus(
            @PathVariable int tenantId, @Valid @RequestBody TenantSubscriptionStatusPatchRequest body) {
        TenantSubscription sub =
                tenantSubscriptionRepository.findByTenantId(tenantId).orElseThrow();
        sub.setStatus(body.status());
        tenantSubscriptionRepository.save(sub);
        platformAuditService.record(
                "TENANT_SUBSCRIPTION_STATUS",
                "TenantSubscription",
                String.valueOf(tenantId),
                body.status().name());
        return ResponseEntity.noContent().build();
    }

    private static SubscriptionPlanResponse toDto(SubscriptionPlan p) {
        return new SubscriptionPlanResponse(p.getId(), p.getPlanCode(), p.getName(), p.getDescription(), p.getActive());
    }
}
