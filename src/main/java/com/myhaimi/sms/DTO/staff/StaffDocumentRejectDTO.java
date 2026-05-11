package com.myhaimi.sms.DTO.staff;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * DTO for POST /api/staff/{staffId}/documents/{docId}/reject.
 * Rejection remarks are required so the HR team knows why the document was rejected.
 */
@Data
public class StaffDocumentRejectDTO {

    @NotBlank(message = "Rejection remarks are required.")
    @Size(max = 1024, message = "Remarks must not exceed 1024 characters.")
    private String remarks;
}

