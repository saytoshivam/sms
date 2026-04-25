package com.myhaimi.sms.modules.platform.events;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.myhaimi.sms.notifications.InProcessNotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Default publisher: structured JSON log line (ops can ship logs to observability).
 * Also invokes {@link com.myhaimi.sms.notifications.InProcessNotificationService} for startup-friendly notification hooks.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class LoggingDomainEventPublisher implements DomainEventPublisher {

    private final ObjectMapper objectMapper;
    private final InProcessNotificationService inProcessNotificationService;

    @Override
    public void publishFeePaid(FeePaidEvent event) {
        Map<String, Object> envelope = new LinkedHashMap<>();
        envelope.put("type", "fee_paid");
        envelope.put("occurredAt", event.occurredAt().toString());
        envelope.put("tenantId", event.tenantId());
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("invoiceId", event.invoiceId());
        payload.put("paymentId", event.paymentId());
        payload.put("studentId", event.studentId());
        payload.put("gatewayOrderId", event.gatewayOrderId());
        payload.put("amount", event.amount());
        payload.put("invoiceStatus", event.invoiceStatus());
        envelope.put("payload", payload);
        try {
            log.info("DOMAIN_EVENT {}", objectMapper.writeValueAsString(envelope));
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize fee_paid event", e);
        }
        inProcessNotificationService.onFeePaid(event);
    }
}
