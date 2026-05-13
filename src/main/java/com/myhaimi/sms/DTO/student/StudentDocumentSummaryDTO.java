package com.myhaimi.sms.DTO.student;

import com.myhaimi.sms.entity.enums.DocumentCollectionStatus;
import com.myhaimi.sms.entity.enums.DocumentUploadStatus;
import com.myhaimi.sms.entity.enums.DocumentVerificationStatus;
import com.myhaimi.sms.entity.enums.StudentDocumentStatus;
import com.myhaimi.sms.entity.enums.VerificationSource;
import lombok.Data;

import java.time.Instant;

@Data
public class StudentDocumentSummaryDTO {
    private Integer id;
    private String documentType;
    /**
     * Human-readable name from the document_types master table.
     * Populated for all new rows created from school requirements.
     * Null for legacy rows — frontend should fall back to formatting documentType code.
     */
    private String documentTypeName;

    /** @deprecated Use fileId + GET /api/files/{fileId}/download-url instead. Never contains a raw S3 URL. */
    @Deprecated
    private String fileUrl;

    /** ID of the FileObject row if a file was uploaded via the file module. Null for old records. */
    private Long fileId;

    // ── File metadata (populated when fileId is non-null) ─────────────────────
    private String originalFilename;
    private Long   fileSize;
    private String contentType;
    private Instant uploadedAt;

    // ── Lifecycle status ──────────────────────────────────────────────────────
    private DocumentCollectionStatus   collectionStatus;
    private DocumentUploadStatus       uploadStatus;
    private DocumentVerificationStatus verificationStatus;
    /** How the document was verified — null if not yet verified. */
    private VerificationSource verificationSource;

    /**
     * Single computed status string derived from the three lifecycle fields.
     * Precedence: NOT_REQUIRED > REJECTED > VERIFIED > UPLOADED > COLLECTED_PHYSICAL > PENDING_COLLECTION.
     * Frontend should use this for display; individual fields are available for detailed logic.
     */
    private String displayStatus;

    /**
     * @deprecated Use collectionStatus, uploadStatus, verificationStatus instead.
     * Kept for backward compatibility with legacy data.
     */
    @Deprecated
    private StudentDocumentStatus status;

    private Integer verifiedByStaffId;
    private Instant verifiedAt;
    private String  remarks;
    private Instant createdAt;
}