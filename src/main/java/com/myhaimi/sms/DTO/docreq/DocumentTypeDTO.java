package com.myhaimi.sms.DTO.docreq;

import com.myhaimi.sms.entity.enums.DocumentTargetType;
import lombok.Data;

@Data
public class DocumentTypeDTO {
    private Integer id;
    private String code;
    private String name;
    private String description;
    private DocumentTargetType targetType;
    private boolean systemDefined;
    private boolean active;
    private int sortOrder;
}

