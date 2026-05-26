package com.myhaimi.sms.DTO.fee;

import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * DTO projection of a single {@link com.myhaimi.sms.entity.FeePaymentAllocation}.
 */
@Data
public class FeePaymentAllocationDTO {
    private Long id;
    private Long demandId;
    private String demandNo;
    /** Human-readable fee head name, e.g. "Tuition Fee". */
    private String feeHeadName;
    /** Short fee head code, e.g. "TUI". */
    private String feeHeadCode;
    /** Installment label, e.g. "Term 1". */
    private String installmentName;
    private BigDecimal allocatedAmount;
    private BigDecimal demandPayableAmount;
    private BigDecimal demandPaidAmount;
    private BigDecimal demandBalanceAmount;
    private String demandStatus;
    private Instant createdAt;
}

