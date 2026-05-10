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
    private String fileUrl;
    private StudentDocumentCollectionStatus collectionStatus;
    private StudentDocumentUploadStatus uploadStatus;
    private StudentDocumentVerificationStatus verificationStatus;

    /**
     * Single computed status string derived from the three lifecycle fields.
     * Precedence: VERIFIED > REJECTED > UPLOADED > COLLECTED_PHYSICAL > NOT_REQUIRED > PENDING_COLLECTION.
     * Frontend should use this for display; individual fields are available for detailed logic.
     */
    private String displayStatus;

    /** @deprecated Use collectionStatus, uploadStatus, verificationStatus instead. */
    @Deprecated
    private StudentDocumentStatus status;

    private Integer verifiedByStaffId;
    private Instant verifiedAt;
    private String remarks;
    private Instant createdAt;
}
