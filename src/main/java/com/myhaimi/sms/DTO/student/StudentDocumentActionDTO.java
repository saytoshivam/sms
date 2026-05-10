package com.myhaimi.sms.DTO.student;

import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * DTO for document action requests (collect, verify, reject, etc.)
 * Allows optional remarks that may be required by specific actions.
 */
@Data
public class StudentDocumentActionDTO {
    @Size(max = 1024)
    private String remarks;
}
