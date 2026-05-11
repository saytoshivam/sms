package com.myhaimi.sms.DTO.staff;

import com.myhaimi.sms.entity.enums.DocumentCollectionStatus;
import com.myhaimi.sms.entity.enums.DocumentUploadStatus;
import com.myhaimi.sms.entity.enums.DocumentVerificationStatus;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * DTO for PATCH /api/staff/{staffId}/documents/{docId}.
 * All fields are optional — only non-null values are applied.
 */
@Data
public class StaffDocumentUpdateDTO {

    private DocumentCollectionStatus   collectionStatus;
    private DocumentUploadStatus       uploadStatus;
    private DocumentVerificationStatus verificationStatus;

    @Size(max = 1024)
    private String remarks;
}

