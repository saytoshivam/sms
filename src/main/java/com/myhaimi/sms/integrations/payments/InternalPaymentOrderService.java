package com.myhaimi.sms.integrations.payments;

import com.myhaimi.sms.config.PaymentIntegrationProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-process payment order registration (startup-friendly replacement for the former payment microservice).
 * Demo mode can POST the gateway webhook back to this app to complete flows without an external PSP.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class InternalPaymentOrderService {

    private final RestTemplate restTemplate;
    private final PaymentIntegrationProperties paymentIntegrationProperties;

    private final Map<String, String> idempotencyIndex = new ConcurrentHashMap<>();

    public record CreateOrderResult(String orderId, String status) {}

    public CreateOrderResult createOrder(
            int tenantId,
            String referenceType,
            String referenceId,
            BigDecimal amount,
            String currency,
            String notifyUrl,
            String idempotencyKey) {
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            String existing = idempotencyIndex.get(idempotencyKey);
            if (existing != null) {
                return new CreateOrderResult(existing, "CREATED");
            }
        }
        String orderId = "pay_" + UUID.randomUUID().toString().replace("-", "");
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            idempotencyIndex.put(idempotencyKey, orderId);
        }

        if (paymentIntegrationProperties.isDemoAutoComplete()
                && notifyUrl != null
                && !notifyUrl.isBlank()) {
            try {
                postSyntheticWebhook(orderId, referenceType, Integer.parseInt(referenceId), amount, notifyUrl);
            } catch (Exception e) {
                log.warn("Demo auto-complete webhook failed for order {}: {}", orderId, e.getMessage());
            }
        }
        return new CreateOrderResult(orderId, "CREATED");
    }

    private void postSyntheticWebhook(
            String orderId, String referenceType, Integer referenceId, BigDecimal amount, String notifyUrl) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("orderId", orderId);
        payload.put("referenceType", referenceType);
        payload.put("referenceId", referenceId);
        payload.put("status", "SUCCEEDED");
        payload.put("amount", amount);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        String secret = paymentIntegrationProperties.getWebhookSecret();
        if (secret != null && !secret.isBlank()) {
            headers.set("X-Webhook-Secret", secret);
        }
        ResponseEntity<Void> response =
                restTemplate.postForEntity(notifyUrl, new HttpEntity<>(payload, headers), Void.class);
        log.info("Posted synthetic webhook for order {} -> {} ({})", orderId, notifyUrl, response.getStatusCode());
    }
}
