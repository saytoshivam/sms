package com.myhaimi.sms.DTO.staff;

import com.myhaimi.sms.entity.enums.StudentDocumentCollectionStatus;
import com.myhaimi.sms.entity.enums.StudentDocumentUploadStatus;
import com.myhaimi.sms.entity.enums.StudentDocumentVerificationStatus;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * DTO for PATCH /api/staff/{staffId}/documents/{docId}.
 * All fields are optional — only non-null values are applied.
 */
@Data
public class StaffDocumentUpdateDTO {

    private StudentDocumentCollectionStatus   collectionStatus;
    private StudentDocumentUploadStatus       uploadStatus;
    private StudentDocumentVerificationStatus verificationStatus;

    @Size(max = 1024)
    private String remarks;
}

