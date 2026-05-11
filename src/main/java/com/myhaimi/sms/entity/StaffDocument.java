package com.myhaimi.sms.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.myhaimi.sms.entity.enums.StudentDocumentCollectionStatus;
import com.myhaimi.sms.entity.enums.StudentDocumentUploadStatus;
import com.myhaimi.sms.entity.enums.StudentDocumentVerificationStatus;
import com.myhaimi.sms.entity.enums.VerificationSource;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/**
 * Tracks the collection / upload / verification lifecycle for a single document
 * belonging to a staff member — mirrors the {@link StudentDocument} pattern.
 */
@Getter
@Setter
@Entity
@Table(name = "staff_documents")
public class StaffDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "staff_id", nullable = false)
    private Staff staff;

    /** Code string matching document_types.code (e.g. "PHOTO", "RESUME"). */
    @Column(name = "document_type", nullable = false, length = 64)
    private String documentType;

    /**
     * FK to document_types.id — set when the row is created from the master catalogue.
     * Null for rows created before the document_types table existed.
     */
    @Column(name = "document_type_id")
    private Integer documentTypeId;

    /**
     * Navigation property for human-readable document type name.
     * {@code insertable=false, updatable=false} — the FK is managed via {@link #documentTypeId}.
     */
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_type_id", insertable = false, updatable = false)
    private DocumentType documentTypeRef;

    /**
     * FK to file_objects.id — set after a file is uploaded via the file module.
     * Null until a file is uploaded.  The navigation property is {@link #fileObject}.
     */
    @Column(name = "file_id", nullable = true)
    private Long fileId;

    /** Navigation property for uploaded file metadata. */
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "file_id", insertable = false, updatable = false)
    private FileObject fileObject;

    // ── Lifecycle status ──────────────────────────────────────────────────────

    @Enumerated(EnumType.STRING)
    @Column(name = "collection_status", nullable = false, length = 32)
    private StudentDocumentCollectionStatus collectionStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "upload_status", nullable = false, length = 32)
    private StudentDocumentUploadStatus uploadStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "verification_status", nullable = false, length = 32)
    private StudentDocumentVerificationStatus verificationStatus;

    /**
     * How the document was verified — null until verificationStatus = VERIFIED.
     * PHYSICAL_ORIGINAL: admin inspected the physical original (no upload needed).
     * UPLOADED_COPY:     verification done against the uploaded scanned copy.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "verification_source", nullable = true, length = 32)
    private VerificationSource verificationSource;

    /** Staff member who verified this document (FK to staff.id; no hard constraint). */
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

