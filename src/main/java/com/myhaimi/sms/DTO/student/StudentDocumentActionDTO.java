package com.myhaimi.sms.DTO.student;

import com.myhaimi.sms.entity.enums.VerificationSource;
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

    /**
     * How the document is being verified.
     * If null, the backend infers from upload/collection state:
     *   - UPLOADED_COPY when uploadStatus = UPLOADED
     *   - PHYSICAL_ORIGINAL when only physically collected
     */
    private VerificationSource verificationSource;
}
