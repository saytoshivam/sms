package com.myhaimi.sms.DTO.subject.importdto;

import lombok.Builder;
import lombok.Data;
import java.util.List;

/** Response for POST /api/subjects/import/commit */
@Data @Builder
public class SubjectImportCommitResultDto {
    private int importedCount;
    private int skippedCount;
    private List<SubjectImportRowResultDto> failedRows;
}

