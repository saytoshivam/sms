package com.myhaimi.sms.modules.platform.repository;

import com.myhaimi.sms.modules.platform.domain.PlatformOperatorNotification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlatformOperatorNotificationRepository extends JpaRepository<PlatformOperatorNotification, Long> {

    Page<PlatformOperatorNotification> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
