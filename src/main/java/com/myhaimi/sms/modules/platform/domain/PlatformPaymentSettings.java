package com.myhaimi.sms.modules.platform.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/**
 * Single-row table (id = 1) mirrored into {@link com.myhaimi.sms.config.PaymentIntegrationProperties} at startup and on admin updates.
 */
@Getter
@Setter
@Entity
@Table(name = "platform_payment_settings")
public class PlatformPaymentSettings {

    @Id
    @Column(nullable = false)
    private Integer id = 1;

    @Column(name = "public_base_url", nullable = false, length = 512)
    private String publicBaseUrl = "http://localhost:8080";

    @Column(name = "webhook_secret", nullable = false, length = 256)
    private String webhookSecret = "change-me-payment-webhook";

    @Column(name = "demo_auto_complete", nullable = false)
    private boolean demoAutoComplete;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    @PreUpdate
    void touch() {
        updatedAt = Instant.now();
    }
}
