package com.myhaimi.sms.modules.platform.service;

import com.myhaimi.sms.config.PaymentIntegrationProperties;
import com.myhaimi.sms.modules.platform.api.dto.PaymentSettingsResponse;
import com.myhaimi.sms.modules.platform.api.dto.PaymentSettingsUpdateRequest;
import com.myhaimi.sms.modules.platform.domain.PlatformPaymentSettings;
import com.myhaimi.sms.modules.platform.repository.PlatformPaymentSettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PlatformPaymentSettingsApplicationService {

    private final PlatformPaymentSettingsRepository repository;
    private final PaymentIntegrationProperties paymentIntegrationProperties;
    private final PlatformAuditService auditService;

    @Transactional(readOnly = true)
    public PaymentSettingsResponse get() {
        PlatformPaymentSettings s = repository.findById(1).orElseThrow();
        return new PaymentSettingsResponse(
                s.getPublicBaseUrl(), maskSecret(s.getWebhookSecret()), s.isDemoAutoComplete());
    }

    @Transactional
    public void update(PaymentSettingsUpdateRequest req) {
        PlatformPaymentSettings s = repository.findById(1).orElseThrow();
        if (req.publicBaseUrl() != null && !req.publicBaseUrl().isBlank()) {
            s.setPublicBaseUrl(req.publicBaseUrl().trim());
        }
        if (req.webhookSecret() != null && !req.webhookSecret().isBlank()) {
            s.setWebhookSecret(req.webhookSecret().trim());
        }
        if (req.demoAutoComplete() != null) {
            s.setDemoAutoComplete(req.demoAutoComplete());
        }
        repository.save(s);
        applyToRuntimeBean(s);
        auditService.record("PAYMENT_SETTINGS_UPDATE", "PlatformPaymentSettings", "1", null);
    }

    public void applyToRuntimeBean(PlatformPaymentSettings s) {
        paymentIntegrationProperties.setPublicBaseUrl(s.getPublicBaseUrl());
        paymentIntegrationProperties.setWebhookSecret(s.getWebhookSecret());
        paymentIntegrationProperties.setDemoAutoComplete(s.isDemoAutoComplete());
    }

    private static String maskSecret(String secret) {
        if (secret == null || secret.length() < 4) {
            return "****";
        }
        return "****" + secret.substring(secret.length() - 4);
    }
}
