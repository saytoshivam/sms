package com.myhaimi.sms.modules.platform.api;

import com.myhaimi.sms.modules.platform.api.dto.PaymentSettingsResponse;
import com.myhaimi.sms.modules.platform.api.dto.PaymentSettingsUpdateRequest;
import com.myhaimi.sms.modules.platform.service.PlatformPaymentSettingsApplicationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/platform/payment-settings")
@RequiredArgsConstructor
public class PlatformPaymentSettingsV1Controller {

    private final PlatformPaymentSettingsApplicationService paymentSettingsApplicationService;

    @GetMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public PaymentSettingsResponse get() {
        return paymentSettingsApplicationService.get();
    }

    @PutMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<Void> update(@Valid @RequestBody PaymentSettingsUpdateRequest body) {
        paymentSettingsApplicationService.update(body);
        return ResponseEntity.noContent().build();
    }
}
