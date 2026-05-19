package com.myhaimi.sms.DTO.fee;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/** One row in the Receipt Register report. */
@Data
@AllArgsConstructor
@NoArgsConstructor
public class ReceiptRegisterRowDTO {
    private Long paymentId;
    private Long receiptId;
    private String receiptNo;
    private LocalDate paymentDate;
    private Integer studentId;
    private String studentName;
    private String admissionNo;
    private String className;
    private BigDecimal amount;
    private String paymentMode;
    private String referenceNo;
    private String status;
    private Instant issuedAt;
    private Instant cancelledAt;
}

