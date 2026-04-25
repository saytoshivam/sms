package com.myhaimi.sms.modules.platform.service;

import com.myhaimi.sms.modules.platform.api.dto.PlatformFeatureFlagResponse;
import com.myhaimi.sms.modules.platform.api.dto.PlatformFeatureFlagUpdateRequest;
import com.myhaimi.sms.modules.platform.domain.PlatformFeatureFlag;
import com.myhaimi.sms.modules.platform.repository.PlatformFeatureFlagRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class PlatformFeatureFlagAdminService {

    private final PlatformFeatureFlagRepository flagRepository;
    private final PlatformAuditService auditService;

    @Transactional(readOnly = true)
    public List<PlatformFeatureFlagResponse> list() {
        return flagRepository.findAllByOrderByFlagKeyAsc().stream()
                .map(f -> new PlatformFeatureFlagResponse(f.getId(), f.getFlagKey(), f.isEnabled(), f.getDescription()))
                .toList();
    }

    @Transactional
    public PlatformFeatureFlagResponse update(long id, PlatformFeatureFlagUpdateRequest req) {
        PlatformFeatureFlag f = flagRepository.findById(id).orElseThrow();
        if (req.enabled() != null) {
            f.setEnabled(req.enabled());
        }
        if (req.description() != null) {
            f.setDescription(req.description());
        }
        flagRepository.save(f);
        auditService.record("PLATFORM_FLAG_UPDATE", "PlatformFeatureFlag", f.getFlagKey(), null);
        return new PlatformFeatureFlagResponse(f.getId(), f.getFlagKey(), f.isEnabled(), f.getDescription());
    }
}
