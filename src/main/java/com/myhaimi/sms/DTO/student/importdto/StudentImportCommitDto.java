package com.myhaimi.sms.DTO.student.importdto;

import lombok.Data;

/**
 * Request body for POST /api/students/import/commit.
 */
@Data
public class StudentImportCommitDto {

    /**
     * Token returned by the preview call.
     * The server uses it to retrieve the already-validated rows from its session store.
     */
    private String importToken;

    /**
     * When {@code true}, the whole import is aborted if any valid row generates
     * an unexpected error at commit time. Default is {@code false} (best-effort,
     * persist as many valid rows as possible).
     */
    private boolean strictMode = false;
}

