package com.myhaimi.sms.DTO.subject.importdto;

import lombok.Data;

/** Request body for POST /api/subjects/import/commit */
@Data
public class SubjectImportCommitDto {
    private String  importToken;
    private boolean strictMode = false;
}

