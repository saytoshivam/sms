package com.myhaimi.sms.modules.platform.events;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Emitted when an online fee payment is confirmed (gateway → monolith webhook).
 * Intended for Kafka / notification consumers (same JSON shape when bridged).
 */
public record FeePaidEvent(
        Instant occurredAt,
        Integer tenantId,
        Integer invoiceId,
        Integer paymentId,
        Integer studentId,
        String gatewayOrderId,
        BigDecimal amount,
        String invoiceStatus
) {}
