package com.myhaimi.sms.DTO.student;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * DTO for POST /api/students/{studentId}/documents/{docId}/reject
 * Remarks are required for rejection so the student/guardian knows why.
 */
@Data
public class StudentDocumentRejectDTO {

    @NotBlank(message = "Rejection remarks are required.")
    @Size(max = 1024, message = "Remarks must not exceed 1024 characters.")
    private String remarks;
}

