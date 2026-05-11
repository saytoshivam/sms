package com.myhaimi.sms.DTO.docreq;

import com.myhaimi.sms.entity.enums.DocumentRequirementStatus;
import com.myhaimi.sms.entity.enums.DocumentTargetType;
import lombok.Data;

import java.util.List;

/** Payload for PUT /api/schools/document-requirements — replaces all requirements for a target type. */
@Data
public class SaveDocumentRequirementsPayload {
    private DocumentTargetType targetType;
    private List<RequirementItem> requirements;

    @Data
    public static class RequirementItem {
        /** Existing document_types.id — or null to create a new custom type. */
        private Integer documentTypeId;
        /** Code for a new custom type (only used when documentTypeId is null). */
        private String code;
        /** Human-readable name for a new custom type (only used when documentTypeId is null). */
        private String name;
        private DocumentRequirementStatus requirementStatus;
        private int sortOrder;
    }
}

