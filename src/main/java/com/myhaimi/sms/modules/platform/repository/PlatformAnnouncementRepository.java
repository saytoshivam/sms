package com.myhaimi.sms.modules.platform.repository;

import com.myhaimi.sms.modules.platform.domain.PlatformAnnouncement;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PlatformAnnouncementRepository extends JpaRepository<PlatformAnnouncement, Long> {

    List<PlatformAnnouncement> findByPublishedTrueOrderByCreatedAtDesc();

    boolean existsByTitle(String title);
}
