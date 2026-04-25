package com.myhaimi.sms.modules.subscription.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@Entity
@Table(name = "subscription_features")
public class SubscriptionFeature {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "feature_code", nullable = false, unique = true, length = 128)
    private String featureCode;

    @Column(nullable = false, length = 256)
    private String name;

    @Column(length = 512)
    private String description;

    /**
     * Master switch: when false, the feature is off for every tenant regardless of plan.
     */
    @Column(name = "globally_enabled", nullable = false)
    private Boolean globallyEnabled = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}
