package com.myhaimi.sms.DTO.student;

import com.myhaimi.sms.entity.enums.StudentDocumentStatus;
import lombok.Data;

import java.time.Instant;

@Data
public class StudentDocumentSummaryDTO {
    private Integer id;
    private String documentType;
    private String fileUrl;
    private StudentDocumentStatus status;
    private Integer verifiedByStaffId;
    private Instant verifiedAt;
    private String remarks;
    private Instant createdAt;
}
