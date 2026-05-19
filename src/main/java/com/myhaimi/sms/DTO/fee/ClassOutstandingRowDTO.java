package com.myhaimi.sms.DTO.fee;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/** One row in the Class-wise Outstanding Report. */
@Data
@AllArgsConstructor
@NoArgsConstructor
public class ClassOutstandingRowDTO {
    private Integer classGroupId;
    private String className;
    private String section;
    private long studentCount;
    private long demandCount;
    private BigDecimal totalPayable;
    private BigDecimal totalPaid;
    private BigDecimal totalOutstanding;
}

