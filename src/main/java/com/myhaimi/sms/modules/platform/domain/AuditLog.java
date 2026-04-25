package com.myhaimi.sms.modules.platform.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@Entity
@Table(name = "audit_logs")
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    @Column(name = "actor_email", length = 256)
    private String actorEmail;

    @Column(nullable = false, length = 96)
    private String action;

    @Column(name = "resource_type", length = 96)
    private String resourceType;

    @Column(name = "resource_id", length = 128)
    private String resourceId;

    @Column(columnDefinition = "TEXT")
    private String detail;
}
