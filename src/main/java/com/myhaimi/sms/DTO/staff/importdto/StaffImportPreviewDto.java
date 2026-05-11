package com.myhaimi.sms.DTO.staff.importdto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

/** Response for POST /api/staff/import/preview */
@Data
@Builder
public class StaffImportPreviewDto {

    /** Opaque token — send back in the commit request. Expires in 30 minutes. */
    private String importToken;

    private int totalRows;
    private int validRows;      // VALID + WARN (will be imported)
    private int warnRows;       // WARN only
    private int invalidRows;
    private int duplicateRows;

    /** Per-row details. All rows are listed in order. */
    private List<StaffImportRowResultDto> rows;
}

