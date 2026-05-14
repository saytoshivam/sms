package com.myhaimi.sms.DTO.subject.importdto;

import lombok.Builder;
import lombok.Data;
import java.util.List;

/** Response for POST /api/subjects/import/preview */
@Data @Builder
public class SubjectImportPreviewDto {
    private String importToken;
    private int totalRows;
    private int validRows;
    private int invalidRows;
    private int duplicateRows;
    private List<SubjectImportRowResultDto> rows;
}

