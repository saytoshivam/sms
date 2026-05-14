package com.myhaimi.sms.DTO.classgroup.importdto;

import lombok.Data;

@Data
public class ClassGroupImportRowDto {
    private int    rowNumber;
    private String code;
    private String displayName;
    private String gradeLevel;
    private String section;
    private String capacity;
}

