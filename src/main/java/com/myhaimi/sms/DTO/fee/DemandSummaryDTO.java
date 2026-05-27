package com.myhaimi.sms.DTO.fee;

import lombok.Data;

import java.math.BigDecimal;

/** Aggregate KPI summary returned by GET /api/fees/demands/summary. */
@Data
public class DemandSummaryDTO {
    /** Total number of matching demands. */
    private long totalDemands;
    /** Sum of payableAmount for all matching demands. */
    private BigDecimal totalPayable;
    /** Sum of paidAmount for all matching demands. */
    private BigDecimal totalPaid;
    /** Sum of balanceAmount where status is UNPAID or PARTIAL. */
    private BigDecimal totalOutstanding;
    /** Sum of balanceAmount where status is UNPAID/PARTIAL and dueDate < today. */
    private BigDecimal overdueAmount;
    /** Count of demands where status is UNPAID/PARTIAL and dueDate < today. */
    private long overdueCount;
    /** Sum of balanceAmount where status is PARTIAL only. */
    private BigDecimal partialBalance;
}

