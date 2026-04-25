package com.myhaimi.sms.integrations.payments;

import com.myhaimi.sms.config.PaymentIntegrationProperties;
import com.myhaimi.sms.service.impl.FeeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * Inbound callbacks from the payment microservice (server-to-server). Secured with a shared secret header, not JWT.
 */
@RestController
@RequestMapping("/api/v1/integrations/payments")
@RequiredArgsConstructor
public class PaymentWebhookController {

    private final FeeService feeService;
    private final PaymentIntegrationProperties paymentProperties;

    @PostMapping("/webhook")
    public ResponseEntity<Void> webhook(
            @RequestHeader(value = "X-Webhook-Secret", required = false) String secret,
            @RequestBody PaymentWebhookPayload payload
    ) {
        if (!constantTimeEquals(paymentProperties.getWebhookSecret(), secret)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        if (payload == null || payload.orderId() == null || payload.referenceType() == null) {
            return ResponseEntity.badRequest().build();
        }
        if (!"FEE_INVOICE".equalsIgnoreCase(payload.referenceType())) {
            return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).build();
        }
        feeService.applyGatewayPaymentConfirmation(payload);
        return ResponseEntity.noContent().build();
    }

    private static boolean constantTimeEquals(String expected, String actual) {
        if (expected == null || actual == null) {
            return false;
        }
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] a = md.digest(expected.getBytes(StandardCharsets.UTF_8));
            byte[] b = md.digest(actual.getBytes(StandardCharsets.UTF_8));
            return MessageDigest.isEqual(a, b);
        } catch (Exception e) {
            return false;
        }
    }
}
