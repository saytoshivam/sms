package com.myhaimi.sms.modules.platform.repository;

import com.myhaimi.sms.modules.platform.domain.PlatformPaymentSettings;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlatformPaymentSettingsRepository extends JpaRepository<PlatformPaymentSettings, Integer> {}
