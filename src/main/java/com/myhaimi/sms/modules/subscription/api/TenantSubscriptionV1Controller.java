package com.myhaimi.sms.modules.subscription.api;

import com.myhaimi.sms.modules.platform.api.dto.TenantSubscriptionResponse;
import com.myhaimi.sms.modules.subscription.domain.SubscriptionStatus;
import com.myhaimi.sms.modules.subscription.domain.TenantSubscription;
import com.myhaimi.sms.modules.subscription.repository.TenantSubscriptionRepository;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/tenant/subscription")
@RequiredArgsConstructor
public class TenantSubscriptionV1Controller {

    private final TenantSubscriptionRepository tenantSubscriptionRepository;

    @GetMapping("/me")
    public ResponseEntity<TenantSubscriptionResponse> current() {
        Integer tenantId = TenantContext.getTenantId();
        if (tenantId == null) {
            return ResponseEntity.ok(TenantSubscriptionResponse.platform());
        }
        return tenantSubscriptionRepository
                .findByTenantIdAndStatus(tenantId, SubscriptionStatus.ACTIVE)
                .map(TenantSubscriptionV1Controller::toDto)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.ok(TenantSubscriptionResponse.none(tenantId)));
    }

    private static TenantSubscriptionResponse toDto(TenantSubscription ts) {
        return new TenantSubscriptionResponse(
                ts.getTenantId(),
                ts.getPlan().getPlanCode(),
                ts.getPlan().getName(),
                ts.getStatus().name(),
                ts.getStartsAt(),
                ts.getEndsAt());
    }
}
