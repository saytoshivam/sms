package com.myhaimi.sms.DTO.staff.importdto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

/** Response for POST /api/staff/import/commit */
@Data
@Builder
public class StaffImportCommitResultDto {
    private int importedCount;
    private int skippedCount;

    /** Rows that failed at commit time (DB constraint violations, etc.). */
    private List<StaffImportRowResultDto> failedRows;
}

