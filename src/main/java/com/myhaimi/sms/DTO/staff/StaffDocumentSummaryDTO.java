package com.myhaimi.sms.DTO.staff;

import com.myhaimi.sms.entity.enums.StudentDocumentCollectionStatus;
import com.myhaimi.sms.entity.enums.StudentDocumentUploadStatus;
import com.myhaimi.sms.entity.enums.StudentDocumentVerificationStatus;
import com.myhaimi.sms.entity.enums.VerificationSource;
import lombok.Data;

import java.time.Instant;

@Data
public class StaffDocumentSummaryDTO {

    private Integer id;
    private String  documentType;

    /**
     * Human-readable name from the document_types master table.
     * Null for legacy rows — frontend should format the documentType code.
     */
    private String  documentTypeName;

    /** ID of the FileObject row if a file was uploaded. Null until uploaded. */
    private Long    fileId;

    // ── File metadata (populated when fileId is non-null) ─────────────────────
    private String  originalFilename;
    private Long    fileSize;
    private String  contentType;
    private Instant uploadedAt;

    // ── Lifecycle status ──────────────────────────────────────────────────────
    private StudentDocumentCollectionStatus   collectionStatus;
    private StudentDocumentUploadStatus       uploadStatus;
    private StudentDocumentVerificationStatus verificationStatus;

    /** How the document was verified — null if not yet verified. */
    private VerificationSource verificationSource;

    /**
     * Single computed status string derived from the three lifecycle fields.
     * Precedence: NOT_REQUIRED > REJECTED > VERIFIED > UPLOADED > COLLECTED_PHYSICAL > PENDING_COLLECTION.
     */
    private String  displayStatus;

    private Integer verifiedByStaffId;
    private Instant verifiedAt;
    private String  remarks;
    private Instant createdAt;
}

