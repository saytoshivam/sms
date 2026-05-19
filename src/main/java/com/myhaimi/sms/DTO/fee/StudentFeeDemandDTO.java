package com.myhaimi.sms.DTO.fee;

import com.myhaimi.sms.entity.enums.StudentFeeDemandStatus;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Data
public class StudentFeeDemandDTO {
    private Long id;
    private Integer schoolId;
    private Integer studentId;
    private String studentName;
    private Integer academicYearId;
    private String academicYearLabel;
    private Integer feePlanId;
    private String feePlanName;
    private Integer feeHeadId;
    private String feeHeadCode;
    private String feeHeadName;
    private Integer feePlanItemId;
    private Integer installmentId;
    private String installmentName;
    private String demandNo;
    private String description;
    private BigDecimal originalAmount;
    private BigDecimal concessionAmount;
    private BigDecimal fineAmount;
    private BigDecimal payableAmount;
    private BigDecimal paidAmount;
    private BigDecimal balanceAmount;
    private LocalDate dueDate;
    private StudentFeeDemandStatus status;
    private Instant generatedAt;
    private Instant createdAt;
    private Instant updatedAt;
}
