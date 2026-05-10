package com.myhaimi.sms.DTO.student.importdto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

/**
 * Response body for POST /api/students/import/preview.
 */
@Data
@Builder
public class StudentImportPreviewDto {

    /** Opaque token – send back in the commit request to avoid re-upload. */
    private String importToken;

    private int totalRows;
    private int validRows;
    private int invalidRows;
    private int duplicateRows;

    /** Per-row details. Only rows with status INVALID or DUPLICATE have non-empty {@code errors}. */
    private List<StudentImportRowResultDto> rows;
}

