package com.myhaimi.sms.modules.platform.service;

import com.myhaimi.sms.entity.School;
import com.myhaimi.sms.modules.platform.api.dto.PlatformSchoolUpdateRequest;
import com.myhaimi.sms.modules.subscription.domain.SubscriptionStatus;
import com.myhaimi.sms.modules.subscription.repository.TenantSubscriptionRepository;
import com.myhaimi.sms.repository.SchoolRepo;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PlatformSchoolWriteService {

    private final SchoolRepo schoolRepo;
    private final TenantSubscriptionRepository tenantSubscriptionRepository;
    private final PlatformAuditService auditService;

    @Transactional
    public School update(int schoolId, PlatformSchoolUpdateRequest req) {
        School s = schoolRepo.findById(schoolId).orElseThrow();
        if (!req.code().equals(s.getCode()) && schoolRepo.existsByCodeAndIdNot(req.code(), schoolId)) {
            throw new IllegalArgumentException("School code already exists: " + req.code());
        }
        s.setName(req.name());
        s.setCode(req.code());
        School saved = schoolRepo.save(s);
        auditService.record("SCHOOL_UPDATE", "School", String.valueOf(schoolId), "name/code");
        return saved;
    }

    @Transactional
    public void archive(int schoolId) {
        School s = schoolRepo.findById(schoolId).orElseThrow();
        s.setArchived(true);
        schoolRepo.save(s);
        tenantSubscriptionRepository
                .findByTenantId(schoolId)
                .ifPresent(ts -> {
                    ts.setStatus(SubscriptionStatus.CANCELLED);
                    tenantSubscriptionRepository.save(ts);
                });
        auditService.record("SCHOOL_ARCHIVE", "School", String.valueOf(schoolId), null);
    }

    @Transactional
    public void restore(int schoolId) {
        School s = schoolRepo.findById(schoolId).orElseThrow();
        s.setArchived(false);
        schoolRepo.save(s);
        tenantSubscriptionRepository
                .findByTenantId(schoolId)
                .ifPresent(ts -> {
                    ts.setStatus(SubscriptionStatus.ACTIVE);
                    tenantSubscriptionRepository.save(ts);
                });
        auditService.record("SCHOOL_RESTORE", "School", String.valueOf(schoolId), null);
    }
}
