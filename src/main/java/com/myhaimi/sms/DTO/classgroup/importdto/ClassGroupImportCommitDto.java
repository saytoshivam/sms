package com.myhaimi.sms.DTO.classgroup.importdto;

import lombok.Data;

@Data
public class ClassGroupImportCommitDto {
    private String importToken;
    private boolean strictMode = false;
}

