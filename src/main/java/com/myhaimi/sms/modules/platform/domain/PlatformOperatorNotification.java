package com.myhaimi.sms.modules.platform.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@Entity
@Table(name = "platform_operator_notifications")
public class PlatformOperatorNotification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(nullable = false, length = 64)
    private String kind;

    @Column(nullable = false, length = 512)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String body;

    @Column(name = "tenant_id")
    private Integer tenantId;

    @Column(name = "actor_email", length = 255)
    private String actorEmail;

    @Column(columnDefinition = "TEXT")
    private String detail;
}
