package com.myhaimi.sms.modules.platform.service;

import com.myhaimi.sms.modules.platform.api.dto.PlatformMetricsResponse;
import com.myhaimi.sms.modules.subscription.domain.SubscriptionStatus;
import com.myhaimi.sms.modules.subscription.repository.TenantSubscriptionRepository;
import com.myhaimi.sms.repository.SchoolRepo;
import com.myhaimi.sms.repository.StudentRepo;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PlatformMetricsService {

    private final SchoolRepo schoolRepo;
    private final StudentRepo studentRepo;
    private final TenantSubscriptionRepository tenantSubscriptionRepository;

    @Transactional(readOnly = true)
    public PlatformMetricsResponse metrics() {
        long totalSchools = schoolRepo.count();
        long activeSchools = schoolRepo.countByArchivedFalse();
        long totalStudents = studentRepo.count();
        long activeSubscriptions = tenantSubscriptionRepository.countByStatus(SubscriptionStatus.ACTIVE);
        return new PlatformMetricsResponse(totalSchools, activeSchools, totalStudents, activeSubscriptions);
    }
}
