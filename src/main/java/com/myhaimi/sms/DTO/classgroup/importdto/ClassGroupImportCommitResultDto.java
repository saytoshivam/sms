package com.myhaimi.sms.DTO.classgroup.importdto;

import lombok.Builder; import lombok.Data; import java.util.List;

@Data @Builder
public class ClassGroupImportCommitResultDto {
    private int importedCount, skippedCount;
    private List<ClassGroupImportRowResultDto> failedRows;
}

