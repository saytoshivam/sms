package com.myhaimi.sms.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "sms.payments")
public class PaymentIntegrationProperties {

    /**
     * Public base URL of this monolith used to build webhook callback URLs for synthetic/demo gateway completion.
     */
    private String publicBaseUrl = "http://localhost:8080";

    /**
     * Shared secret sent as {@code X-Webhook-Secret} on synthetic payment → monolith callbacks (rotate in production).
     */
    private String webhookSecret = "change-me-payment-webhook";

    /**
     * When true, after creating a pending online order the app immediately POSTs a successful webhook to
     * {@code /api/v1/integrations/payments/webhook} (local demos without a real PSP).
     */
    private boolean demoAutoComplete = false;
}
