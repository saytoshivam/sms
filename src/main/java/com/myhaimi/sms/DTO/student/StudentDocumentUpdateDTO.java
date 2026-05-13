package com.myhaimi.sms.DTO.student;

import com.myhaimi.sms.entity.enums.DocumentCollectionStatus;
import com.myhaimi.sms.entity.enums.DocumentUploadStatus;
import com.myhaimi.sms.entity.enums.DocumentVerificationStatus;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * DTO for PATCH /api/students/{studentId}/documents/{docId}
 * Allows partial updates to document fields.
 */
@Data
public class StudentDocumentUpdateDTO {
    private DocumentCollectionStatus   collectionStatus;
    private DocumentUploadStatus       uploadStatus;
    private DocumentVerificationStatus verificationStatus;

    @Size(max = 1024)
    private String remarks;
}