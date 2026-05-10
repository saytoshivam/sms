package com.myhaimi.sms.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.myhaimi.sms.entity.enums.StudentDocumentStatus;
import com.myhaimi.sms.entity.enums.StudentDocumentCollectionStatus;
import com.myhaimi.sms.entity.enums.StudentDocumentUploadStatus;
import com.myhaimi.sms.entity.enums.StudentDocumentVerificationStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

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

    @Column(name = "file_url", nullable = true, length = 1024)
    private String fileUrl;

    /**
     * FK to file_objects.id — set after file is uploaded via FileService.
     * Null until a file is actually uploaded; fileUrl kept for backward compat.
     * This column is the write-side; use {@link #fileObject} for navigation reads.
     */
    @Column(name = "file_id", nullable = true)
    private Long fileId;

    /**
     * Navigation property to the linked FileObject.
     * {@code insertable=false, updatable=false} — the underlying FK is managed via {@link #fileId}.
     */
    @ToString.Exclude
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "file_id", insertable = false, updatable = false)
    private FileObject fileObject;

    @Enumerated(EnumType.STRING)
    @Column(name = "collection_status", nullable = false, length = 32)
    private StudentDocumentCollectionStatus collectionStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "upload_status", nullable = false, length = 32)
    private StudentDocumentUploadStatus uploadStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "verification_status", nullable = false, length = 32)
    private StudentDocumentVerificationStatus verificationStatus;

    @Enumerated(EnumType.STRING)
    @Column(nullable = true, length = 32)
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
