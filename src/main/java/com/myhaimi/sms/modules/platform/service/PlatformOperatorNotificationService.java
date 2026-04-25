package com.myhaimi.sms.modules.platform.service;

import com.myhaimi.sms.modules.platform.api.dto.PlatformOperatorNotificationDTO;
import com.myhaimi.sms.modules.platform.domain.PlatformOperatorNotification;
import com.myhaimi.sms.modules.platform.domain.PlatformOperatorNotificationRead;
import com.myhaimi.sms.modules.platform.repository.PlatformOperatorNotificationReadRepository;
import com.myhaimi.sms.modules.platform.repository.PlatformOperatorNotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class PlatformOperatorNotificationService {

    public static final String KIND_PLAN_CHANGE_REQUEST = "TENANT_PLAN_CHANGE_REQUEST";

    private final PlatformOperatorNotificationRepository notificationRepository;
    private final PlatformOperatorNotificationReadRepository readRepository;

    @Transactional
    public void recordPlanChangeRequest(
            Integer tenantId,
            String schoolName,
            String requestedPlanCode,
            String requestedPlanName,
            String actorEmail,
            String note) {
        PlatformOperatorNotification n = new PlatformOperatorNotification();
        n.setCreatedAt(Instant.now());
        n.setKind(KIND_PLAN_CHANGE_REQUEST);
        n.setTitle("Subscription plan change requested");
        String safeName = schoolName != null && !schoolName.isBlank() ? schoolName : ("School #" + tenantId);
        StringBuilder body = new StringBuilder();
        body.append(safeName)
                .append(" (tenant ")
                .append(tenantId)
                .append(") requested ")
                .append(requestedPlanName)
                .append(" (")
                .append(requestedPlanCode)
                .append(").");
        if (note != null && !note.isBlank()) {
            body.append(" Note: ").append(note.replace('\n', ' ').trim());
        }
        n.setBody(body.toString());
        n.setTenantId(tenantId);
        n.setActorEmail(actorEmail);
        n.setDetail("requestedPlan=" + requestedPlanCode);
        notificationRepository.save(n);
    }

    @Transactional(readOnly = true)
    public Page<PlatformOperatorNotificationDTO> listForUser(Pageable pageable, Integer userId) {
        Page<PlatformOperatorNotification> page = notificationRepository.findAllByOrderByCreatedAtDesc(pageable);
        List<PlatformOperatorNotification> content = page.getContent();
        if (content.isEmpty()) {
            return new PageImpl<>(List.of(), pageable, page.getTotalElements());
        }
        List<Long> ids = content.stream().map(PlatformOperatorNotification::getId).toList();
        List<Long> readIds = readRepository.findReadIdsForUser(userId, ids);
        Set<Long> readSet = new HashSet<>(readIds);
        List<PlatformOperatorNotificationDTO> dtos = content.stream()
                .map(n -> toDto(n, readSet.contains(n.getId())))
                .toList();
        return new PageImpl<>(dtos, pageable, page.getTotalElements());
    }

    @Transactional(readOnly = true)
    public long unreadCountForUser(Integer userId) {
        return readRepository.countUnreadForUser(userId);
    }

    @Transactional
    public void markRead(long notificationId, Integer userId) {
        if (readRepository.existsByNotificationIdAndUserId(notificationId, userId)) {
            return;
        }
        PlatformOperatorNotificationRead r = new PlatformOperatorNotificationRead();
        r.setNotificationId(notificationId);
        r.setUserId(userId);
        r.setReadAt(Instant.now());
        readRepository.save(r);
    }

    private static PlatformOperatorNotificationDTO toDto(PlatformOperatorNotification n, boolean read) {
        return new PlatformOperatorNotificationDTO(
                n.getId(),
                n.getCreatedAt().toString(),
                n.getKind(),
                n.getTitle(),
                n.getBody(),
                n.getTenantId(),
                n.getActorEmail(),
                n.getDetail(),
                read);
    }
}
