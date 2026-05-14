package com.myhaimi.sms.DTO.classgroup.importdto;

import lombok.Builder; import lombok.Data; import java.util.List;

@Data @Builder
public class ClassGroupImportPreviewDto {
    private String importToken;
    private int totalRows, validRows, invalidRows, duplicateRows;
    private List<ClassGroupImportRowResultDto> rows;
}

