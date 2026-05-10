package com.myhaimi.sms.DTO.student.importdto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

/**
 * Response body for POST /api/students/import/commit.
 */
@Data
@Builder
public class StudentImportCommitResultDto {

    private int importedCount;
    private int skippedCount;

    /**
     * Rows that were VALID at preview time but failed to persist at commit time
     * (e.g., concurrent duplicates, DB constraint violations).
     */
    private List<StudentImportRowResultDto> failedRows;
}
