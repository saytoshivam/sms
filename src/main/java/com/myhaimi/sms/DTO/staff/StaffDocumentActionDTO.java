package com.myhaimi.sms.DTO.staff;

import com.myhaimi.sms.entity.enums.VerificationSource;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * DTO for staff document action requests (collect, verify).
 * Remarks are optional; verificationSource is inferred from lifecycle state if null.
 */
@Data
public class StaffDocumentActionDTO {

    @Size(max = 1024)
    private String remarks;

    /**
     * How the document is being verified.
     * If null, the backend infers:
     *   - UPLOADED_COPY       when uploadStatus = UPLOADED
     *   - PHYSICAL_ORIGINAL   when only physically collected
     */
    private VerificationSource verificationSource;
}

