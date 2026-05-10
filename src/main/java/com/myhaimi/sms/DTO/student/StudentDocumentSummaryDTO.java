package com.myhaimi.sms.DTO.student;

import com.myhaimi.sms.entity.enums.StudentDocumentStatus;
import com.myhaimi.sms.entity.enums.StudentDocumentCollectionStatus;
import com.myhaimi.sms.entity.enums.StudentDocumentUploadStatus;
import com.myhaimi.sms.entity.enums.StudentDocumentVerificationStatus;
import lombok.Data;

import java.time.Instant;

@Data
public class StudentDocumentSummaryDTO {
    private Integer id;
    private String documentType;

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
    private StudentDocumentCollectionStatus   collectionStatus;
    private StudentDocumentUploadStatus       uploadStatus;
    private StudentDocumentVerificationStatus verificationStatus;

    /**
     * Single computed status string derived from the three lifecycle fields.
     * Precedence: NOT_REQUIRED > REJECTED > VERIFIED > UPLOADED > COLLECTED_PHYSICAL > PENDING_COLLECTION.
     * Frontend should use this for display; individual fields are available for detailed logic.
     */
    private String displayStatus;

    /** @deprecated Use collectionStatus, uploadStatus, verificationStatus instead. */
    @Deprecated
    private StudentDocumentStatus status;

    private Integer verifiedByStaffId;
    private Instant verifiedAt;
    private String  remarks;
    private Instant createdAt;
}
