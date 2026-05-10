package com.myhaimi.sms.entity;

import com.myhaimi.sms.entity.enums.FileCategory;
import com.myhaimi.sms.entity.enums.FileStatus;
import com.myhaimi.sms.entity.enums.FileVisibility;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/**
 * Central file/attachment record.
 * Every uploaded file in the ERP has exactly one FileObject row.
 * Raw storage paths are never exposed to clients; signed/temporary URLs are generated on-demand.
 */
@Getter
@Setter
@Entity
@Table(name = "file_objects", indexes = {
        @Index(name = "idx_fo_school",  columnList = "school_id"),
        @Index(name = "idx_fo_owner",   columnList = "owner_type, owner_id"),
        @Index(name = "idx_fo_status",  columnList = "status")
})
public class FileObject {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Tenant isolation: every file belongs to exactly one school. */
    @Column(name = "school_id", nullable = false)
    private Integer schoolId;

    /** The domain entity type that owns this file, e.g. "STUDENT", "TEACHER". */
    @Column(name = "owner_type", nullable = false, length = 64)
    private String ownerType;

    /** FK to the owning entity row (e.g. students.id). Stored as string for cross-entity flexibility. */
    @Column(name = "owner_id", nullable = false, length = 64)
    private String ownerId;

    @Enumerated(EnumType.STRING)
    @Column(name = "file_category", nullable = false, length = 48)
    private FileCategory fileCategory;

    /** Original name supplied by the browser / client. */
    @Column(name = "original_filename", nullable = false, length = 512)
    private String originalFilename;

    /** Sanitised filename stored on disk / object storage (UUID-prefixed, no PII). */
    @Column(name = "stored_filename", nullable = false, length = 512)
    private String storedFilename;

    /** "local" or "s3" at time of upload. */
    @Column(name = "storage_provider", nullable = false, length = 32)
    private String storageProvider;

    /** Bucket name for S3; null for local storage. */
    @Column(name = "bucket_name", length = 128)
    private String bucketName;

    /**
     * Full path key used on the storage provider.
     * Pattern: schools/{schoolId}/{fileCategory}/{ownerType}/{ownerId}/{yyyy}/{MM}/{uuid}-{safeFilename}
     */
    @Column(name = "storage_key", nullable = false, length = 1024)
    private String storageKey;

    @Column(name = "content_type", nullable = false, length = 128)
    private String contentType;

    /** File size in bytes. */
    @Column(name = "file_size", nullable = false)
    private Long fileSize;

    /** MD5 or SHA-256 hex of the raw bytes (for integrity checks). */
    @Column(name = "checksum", length = 64)
    private String checksum;

    @Enumerated(EnumType.STRING)
    @Column(name = "visibility", nullable = false, length = 32)
    private FileVisibility visibility = FileVisibility.SCHOOL_INTERNAL;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private FileStatus status = FileStatus.ACTIVE;

    /** User.id who uploaded the file. */
    @Column(name = "uploaded_by")
    private Integer uploadedBy;

    @Column(name = "uploaded_at", nullable = false, updatable = false)
    private Instant uploadedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @PrePersist
    void prePersist() {
        if (uploadedAt == null) uploadedAt = Instant.now();
    }
}

