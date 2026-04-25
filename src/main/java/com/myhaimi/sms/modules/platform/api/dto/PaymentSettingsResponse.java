package com.myhaimi.sms.modules.platform.api.dto;

public record PaymentSettingsResponse(String publicBaseUrl, String webhookSecretMasked, boolean demoAutoComplete) {}
