package com.myhaimi.sms.modules.subscription.service;

import com.myhaimi.sms.entity.School;
import com.myhaimi.sms.modules.platform.api.dto.PlatformSchoolListItem;
import com.myhaimi.sms.modules.subscription.domain.SubscriptionPlan;
import com.myhaimi.sms.modules.subscription.domain.TenantSubscription;
import com.myhaimi.sms.modules.subscription.repository.TenantSubscriptionRepository;
import com.myhaimi.sms.repository.SchoolRepo;
import com.myhaimi.sms.repository.StudentRepo;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class PlatformSchoolAdminService {

    private final SchoolRepo schoolRepo;
    private final StudentRepo studentRepo;
    private final TenantSubscriptionRepository tenantSubscriptionRepository;

    @Transactional(readOnly = true)
    public PlatformSchoolListItem getSchoolRow(int schoolId) {
        School s = schoolRepo.findById(schoolId).orElseThrow();
        long studentCount = studentRepo.countBySchool_Id(schoolId);
        return toRow(s, studentCount);
    }

    @Transactional(readOnly = true)
    public List<PlatformSchoolListItem> listAllSchoolsWithSubscriptions() {
        Map<Integer, Long> studentCounts = new HashMap<>();
        for (Object[] row : studentRepo.countStudentsGroupedBySchool()) {
            studentCounts.put((Integer) row[0], ((Number) row[1]).longValue());
        }
        List<School> schools = schoolRepo.findAll(Sort.by(Sort.Direction.DESC, "createdAt"));
        List<PlatformSchoolListItem> out = new ArrayList<>(schools.size());
        for (School s : schools) {
            out.add(toRow(s, studentCounts.getOrDefault(s.getId(), 0L)));
        }
        return out;
    }

    private PlatformSchoolListItem toRow(School s, long studentCount) {
        return tenantSubscriptionRepository
                .findByTenantId(s.getId())
                .map(ts -> {
                    SubscriptionPlan p = ts.getPlan();
                    return new PlatformSchoolListItem(
                            s.getId(),
                            s.getName(),
                            s.getCode(),
                            s.getCreatedAt(),
                            p.getPlanCode(),
                            p.getName(),
                            ts.getStatus().name(),
                            s.isArchived(),
                            studentCount);
                })
                .orElseGet(
                        () -> new PlatformSchoolListItem(
                                s.getId(),
                                s.getName(),
                                s.getCode(),
                                s.getCreatedAt(),
                                null,
                                null,
                                "NONE",
                                s.isArchived(),
                                studentCount));
    }
}
