package com.myhaimi.sms.DTO.staff.importdto;

import lombok.Data;

/** Request body for POST /api/staff/import/commit */
@Data
public class StaffImportCommitDto {
    /** Token from the preview response. */
    private String importToken;

    /**
     * If true, the entire batch is rolled back on a single commit-time error.
     * If false (default), rows are imported row-by-row; errors are collected and returned.
     */
    private boolean strictMode = false;
}

