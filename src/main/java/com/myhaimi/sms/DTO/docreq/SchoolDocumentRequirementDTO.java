package com.myhaimi.sms.DTO.docreq;

import com.myhaimi.sms.entity.enums.DocumentRequirementStatus;
import com.myhaimi.sms.entity.enums.DocumentTargetType;
import lombok.Data;

import java.time.Instant;

@Data
public class SchoolDocumentRequirementDTO {
    private Integer id;
    private Integer documentTypeId;
    private String documentTypeCode;
    private String documentTypeName;
    private String documentTypeDescription;
    private DocumentTargetType targetType;
    private DocumentRequirementStatus requirementStatus;
    private boolean active;
    private int sortOrder;
    private Instant createdAt;
    private Instant updatedAt;
}

