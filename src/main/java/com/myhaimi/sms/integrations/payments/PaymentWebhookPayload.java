package com.myhaimi.sms.integrations.payments;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.math.BigDecimal;

@JsonIgnoreProperties(ignoreUnknown = true)
public record PaymentWebhookPayload(
        String orderId,
        String referenceType,
        Integer referenceId,
        String status,
        BigDecimal amount
) {}
