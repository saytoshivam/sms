package com.myhaimi.sms.DTO.student;

import com.myhaimi.sms.entity.enums.StudentDocumentCollectionStatus;
import com.myhaimi.sms.entity.enums.StudentDocumentUploadStatus;
import com.myhaimi.sms.entity.enums.StudentDocumentVerificationStatus;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * DTO for PATCH /api/students/{studentId}/documents/{docId}
 * Allows partial updates to document fields.
 */
@Data
public class StudentDocumentUpdateDTO {
    private StudentDocumentCollectionStatus collectionStatus;
    private StudentDocumentUploadStatus uploadStatus;
    private StudentDocumentVerificationStatus verificationStatus;

    @Size(max = 1024)
    private String remarks;
}
