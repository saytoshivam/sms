package com.myhaimi.sms.DTO.fee;

import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * Full response DTO for a {@link com.myhaimi.sms.entity.FeePayment}.
 * Includes allocations and receipt details.
 */
@Data
public class FeePaymentDTO {
    private Long id;
    private Integer schoolId;
    private Integer studentId;
    private String studentName;
    private String receiptNo;
    private BigDecimal amount;
    private String paymentMode;
    private LocalDate paymentDate;
    private String referenceNo;
    private String notes;
    private String status;
    private Integer collectedByUserId;
    private Instant createdAt;
    private Instant updatedAt;
    private List<FeePaymentAllocationDTO> allocations;
    private FeeReceiptDTO receipt;
}

