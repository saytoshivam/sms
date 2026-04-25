package com.myhaimi.sms.controllers;

import com.myhaimi.sms.DTO.FeeOnlinePaymentIntentRequest;
import com.myhaimi.sms.DTO.FeeOnlinePaymentIntentResponse;
import com.myhaimi.sms.modules.platform.security.RequireFeature;
import com.myhaimi.sms.modules.subscription.SubscriptionFeatureCodes;
import com.myhaimi.sms.service.impl.FeeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/fees")
@RequiredArgsConstructor
public class FeeV1Controller {

    private final FeeService feeService;

    /**
     * Starts an online fee collection via in-process gateway order (requires plan feature {@code fees.online_payments}).
     */
    @PostMapping("/invoices/{invoiceId}/online-intent")
    @RequireFeature(SubscriptionFeatureCodes.FEES_ONLINE_PAYMENTS)
    public ResponseEntity<FeeOnlinePaymentIntentResponse> createOnlineIntent(
            @PathVariable Integer invoiceId,
            @RequestBody(required = false) @Valid FeeOnlinePaymentIntentRequest body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey
    ) {
        FeeOnlinePaymentIntentResponse res = feeService.createOnlinePaymentIntent(invoiceId, body, idempotencyKey);
        return ResponseEntity.status(HttpStatus.CREATED).body(res);
    }
}
