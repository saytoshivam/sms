package com.myhaimi.sms.modules.platform.repository;

import com.myhaimi.sms.modules.platform.domain.PlatformFeatureFlag;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PlatformFeatureFlagRepository extends JpaRepository<PlatformFeatureFlag, Long> {

    Optional<PlatformFeatureFlag> findByFlagKey(String flagKey);

    List<PlatformFeatureFlag> findAllByOrderByFlagKeyAsc();
}
