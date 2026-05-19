package com.myhaimi.sms.integrations.payments;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Inbound callbacks from the payment gateway (server-to-server).
 * Legacy invoice-based online payment flow has been removed; this endpoint
 * now returns 410 Gone — gateway callbacks should be re-routed to the new
 * {@code FeePaymentService}-based flow.
 */
@RestController
@RequestMapping("/api/v1/integrations/payments")
@RequiredArgsConstructor
public class PaymentWebhookController {

    @PostMapping("/webhook")
    public ResponseEntity<Void> webhook(
            @RequestHeader(value = "X-Webhook-Secret", required = false) String secret,
            @RequestBody(required = false) PaymentWebhookPayload payload
    ) {
        // Legacy invoice-based gateway flow removed.
        // Re-implement against FeePaymentService if online payments are needed.
        return ResponseEntity.status(HttpStatus.GONE).build();
    }
}
