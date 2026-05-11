package com.myhaimi.sms.entity;

import com.myhaimi.sms.entity.enums.DocumentRequirementStatus;
import com.myhaimi.sms.entity.enums.DocumentTargetType;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@Entity
@Table(name = "school_document_requirements")
public class SchoolDocumentRequirement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "school_id", nullable = false)
    private Integer schoolId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "document_type_id", nullable = false)
    private DocumentType documentType;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", nullable = false, length = 32)
    private DocumentTargetType targetType;

    @Enumerated(EnumType.STRING)
    @Column(name = "requirement_status", nullable = false, length = 32)
    private DocumentRequirementStatus requirementStatus = DocumentRequirementStatus.REQUIRED;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder = 100;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        Instant n = Instant.now();
        if (createdAt == null) createdAt = n;
        if (updatedAt == null) updatedAt = n;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}

