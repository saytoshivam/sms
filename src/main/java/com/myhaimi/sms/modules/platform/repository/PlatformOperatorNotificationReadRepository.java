package com.myhaimi.sms.modules.platform.repository;

import com.myhaimi.sms.modules.platform.domain.PlatformOperatorNotificationRead;
import com.myhaimi.sms.modules.platform.domain.PlatformOperatorNotificationReadId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface PlatformOperatorNotificationReadRepository
        extends JpaRepository<PlatformOperatorNotificationRead, PlatformOperatorNotificationReadId> {

    boolean existsByNotificationIdAndUserId(Long notificationId, Integer userId);

    @Query("SELECT r.notificationId FROM PlatformOperatorNotificationRead r WHERE r.userId = :userId AND r.notificationId IN :ids")
    List<Long> findReadIdsForUser(
            @Param("userId") Integer userId, @Param("ids") Collection<Long> notificationIds);

    @Query(
            "SELECT COUNT(n) FROM PlatformOperatorNotification n WHERE NOT EXISTS (SELECT 1 FROM PlatformOperatorNotificationRead r WHERE r.notificationId = n.id AND r.userId = :userId)")
    long countUnreadForUser(@Param("userId") Integer userId);
}
