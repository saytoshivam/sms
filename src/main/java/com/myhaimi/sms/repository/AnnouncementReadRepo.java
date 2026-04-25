package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.AnnouncementRead;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AnnouncementReadRepo extends JpaRepository<AnnouncementRead, Integer> {

    boolean existsByStudent_IdAndAnnouncement_Id(int studentId, int announcementId);

    Optional<AnnouncementRead> findByStudent_IdAndAnnouncement_Id(int studentId, int announcementId);
}
