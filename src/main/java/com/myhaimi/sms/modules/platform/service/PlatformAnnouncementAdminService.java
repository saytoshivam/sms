package com.myhaimi.sms.modules.platform.service;

import com.myhaimi.sms.entity.User;
import com.myhaimi.sms.modules.platform.api.dto.PlatformAnnouncementResponse;
import com.myhaimi.sms.modules.platform.api.dto.PlatformAnnouncementWriteRequest;
import com.myhaimi.sms.modules.platform.domain.PlatformAnnouncement;
import com.myhaimi.sms.modules.platform.repository.PlatformAnnouncementRepository;
import com.myhaimi.sms.repository.UserRepo;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class PlatformAnnouncementAdminService {

    private final PlatformAnnouncementRepository announcementRepository;
    private final UserRepo userRepo;
    private final PlatformAuditService auditService;

    @Transactional(readOnly = true)
    public List<PlatformAnnouncementResponse> listAll() {
        return announcementRepository.findAll().stream()
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                .map(PlatformAnnouncementAdminService::toDto)
                .toList();
    }

    @Transactional
    public PlatformAnnouncementResponse create(PlatformAnnouncementWriteRequest req, String actorEmail) {
        User author = userRepo.findFirstByEmailIgnoreCase(actorEmail).orElse(null);
        PlatformAnnouncement a = new PlatformAnnouncement();
        a.setTitle(req.title());
        a.setBody(req.body());
        a.setPublished(req.published());
        a.setAuthor(author);
        PlatformAnnouncement saved = announcementRepository.save(a);
        auditService.record("PLATFORM_ANNOUNCEMENT_CREATE", "PlatformAnnouncement", String.valueOf(saved.getId()), null);
        return toDto(saved);
    }

    @Transactional
    public PlatformAnnouncementResponse update(long id, PlatformAnnouncementWriteRequest req) {
        PlatformAnnouncement a = announcementRepository.findById(id).orElseThrow();
        a.setTitle(req.title());
        a.setBody(req.body());
        a.setPublished(req.published());
        PlatformAnnouncement saved = announcementRepository.save(a);
        auditService.record("PLATFORM_ANNOUNCEMENT_UPDATE", "PlatformAnnouncement", String.valueOf(id), null);
        return toDto(saved);
    }

    @Transactional
    public void delete(long id) {
        announcementRepository.deleteById(id);
        auditService.record("PLATFORM_ANNOUNCEMENT_DELETE", "PlatformAnnouncement", String.valueOf(id), null);
    }

    @Transactional(readOnly = true)
    public List<PlatformAnnouncementResponse> listPublishedFeed() {
        return announcementRepository.findByPublishedTrueOrderByCreatedAtDesc().stream()
                .map(PlatformAnnouncementAdminService::toDto)
                .toList();
    }

    private static PlatformAnnouncementResponse toDto(PlatformAnnouncement a) {
        return new PlatformAnnouncementResponse(
                a.getId(),
                a.getTitle(),
                a.getBody(),
                a.isPublished(),
                a.getCreatedAt(),
                a.getUpdatedAt());
    }
}
