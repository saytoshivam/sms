package com.myhaimi.sms.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.myhaimi.sms.entity.enums.DocumentCollectionStatus;
import com.myhaimi.sms.entity.enums.DocumentUploadStatus;
import com.myhaimi.sms.entity.enums.DocumentVerificationStatus;
import com.myhaimi.sms.entity.enums.StudentDocumentStatus;
import com.myhaimi.sms.entity.enums.VerificationSource;
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

    /**
     * FK to document_types.id — set when document row is created from the school requirements config.
     * Null for legacy rows created before the document_types table existed.
     */
    @Column(name = "document_type_id")
    private Integer documentTypeId;

    /**
     * Navigation property to the master DocumentType — for reading the human-readable name.
     * {@code insertable=false, updatable=false} — managed via {@link #documentTypeId}.
     */
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_type_id", insertable = false, updatable = false)
    private DocumentType documentTypeRef;

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
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "file_id", insertable = false, updatable = false)
    private FileObject fileObject;

    @Enumerated(EnumType.STRING)
    @Column(name = "collection_status", nullable = false, length = 32)
    private DocumentCollectionStatus collectionStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "upload_status", nullable = false, length = 32)
    private DocumentUploadStatus uploadStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "verification_status", nullable = false, length = 32)
    private DocumentVerificationStatus verificationStatus;

    /**
     * How the document was verified — null until verificationStatus = VERIFIED.
     * PHYSICAL_ORIGINAL: admin inspected the physical original (no upload needed).
     * UPLOADED_COPY: verification done against the uploaded scanned copy.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "verification_source", nullable = true, length = 32)
    private VerificationSource verificationSource;

    /**
     * @deprecated Legacy single-field status. Use {@link #collectionStatus},
     * {@link #uploadStatus}, and {@link #verificationStatus} instead.
     */
    @Deprecated
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
