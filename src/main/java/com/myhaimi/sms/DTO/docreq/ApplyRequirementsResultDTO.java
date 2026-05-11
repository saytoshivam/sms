package com.myhaimi.sms.DTO.docreq;

import lombok.Builder;
import lombok.Data;

/** Result of the "apply requirements to existing students" bulk action. */
@Data
@Builder
public class ApplyRequirementsResultDTO {
    /** Number of active students processed. */
    private int studentsProcessed;
    /** Total new student_document rows created across all students. */
    private int documentRowsCreated;
    /** Human-readable summary message. */
    private String message;
}

