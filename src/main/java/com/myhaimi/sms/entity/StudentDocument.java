package com.myhaimi.sms.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.myhaimi.sms.entity.enums.StudentDocumentStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@Entity
@Table(name = "student_documents")
public class StudentDocument {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    @Column(name = "document_type", nullable = false, length = 64)
    private String documentType;

    @Column(name = "file_url", nullable = false, length = 1024)
    private String fileUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private StudentDocumentStatus status;

    @Column(name = "verified_by")
    private Integer verifiedByStaffId;

    @Column(name = "verified_at")
    private Instant verifiedAt;

    @Column(length = 1024)
    private String remarks;

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
