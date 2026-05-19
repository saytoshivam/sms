package com.myhaimi.sms.DTO.fee;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/** One row in the Student Due Report. */
@Data
@AllArgsConstructor
@NoArgsConstructor
public class StudentDueRowDTO {
    private Integer studentId;
    private String studentName;
    private String admissionNo;
    private String className;
    private BigDecimal totalPayable;
    private BigDecimal totalPaid;
    private BigDecimal totalBalance;
}

