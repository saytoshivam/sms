package com.myhaimi.sms.modules.platform.bootstrap;

import com.myhaimi.sms.modules.platform.repository.PlatformPaymentSettingsRepository;
import com.myhaimi.sms.modules.platform.service.PlatformPaymentSettingsApplicationService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Hydrates in-memory {@link com.myhaimi.sms.config.PaymentIntegrationProperties} from the database row.
 */
@Component
@Order(2000)
@RequiredArgsConstructor
public class PlatformPaymentSettingsLoader implements ApplicationRunner {

    private final PlatformPaymentSettingsRepository repository;
    private final PlatformPaymentSettingsApplicationService paymentSettingsApplicationService;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        repository.findById(1).ifPresent(paymentSettingsApplicationService::applyToRuntimeBean);
    }
}
