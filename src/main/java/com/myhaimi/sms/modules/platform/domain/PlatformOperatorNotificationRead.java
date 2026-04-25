package com.myhaimi.sms.modules.platform.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@Entity
@IdClass(PlatformOperatorNotificationReadId.class)
@Table(name = "platform_operator_notification_reads")
public class PlatformOperatorNotificationRead {

    @Id
    @Column(name = "notification_id", nullable = false)
    private Long notificationId;

    @Id
    @Column(name = "user_id", nullable = false)
    private Integer userId;

    @Column(name = "read_at", nullable = false)
    private Instant readAt;
}
