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
    /** Admission number of the student — for display on receipt. */
    private String studentAdmissionNo;
    /** Class/section label, e.g. "Grade 7 - A" — for display on receipt. */
    private String classGroupName;
    private String receiptNo;
    private BigDecimal amount;
    private String paymentMode;
    private LocalDate paymentDate;
    private String referenceNo;
    private String notes;
    private String status;
    private Integer collectedByUserId;
    /** Outstanding balance for this student AFTER this payment (for receipt display). */
    private BigDecimal outstandingBalance;
    private Instant createdAt;
    private Instant updatedAt;
    private List<FeePaymentAllocationDTO> allocations;
    private FeeReceiptDTO receipt;
}

