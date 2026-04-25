package com.myhaimi.sms.modules.platform.api.dto;

import jakarta.validation.constraints.Size;

public record PaymentSettingsUpdateRequest(
        @Size(max = 512) String publicBaseUrl,
        /** When null or blank, existing secret is kept. */
        @Size(max = 256) String webhookSecret,
        Boolean demoAutoComplete) {}
