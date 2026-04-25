package com.myhaimi.sms.modules.platform.api.dto;

import com.myhaimi.sms.modules.subscription.domain.SubscriptionStatus;
import jakarta.validation.constraints.NotNull;

public record TenantSubscriptionStatusPatchRequest(@NotNull SubscriptionStatus status) {}
