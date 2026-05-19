package com.myhaimi.sms.DTO.fee;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * Aggregated fee KPIs for the school dashboard.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
public class FeeDashboardDTO {

    /** Sum of payable_amount across all demands. */
    private BigDecimal totalExpected;

    /** Sum of paid_amount across all demands (confirmed payments). */
    private BigDecimal totalCollected;

    /** Sum of balance_amount for UNPAID + PARTIAL demands. */
    private BigDecimal totalOutstanding;

    /** Balance on demands whose due_date is in the past (overdue). */
    private BigDecimal overdueAmount;

    /** Collection rate = totalCollected / totalExpected * 100 (0 when expected is 0). */
    private BigDecimal collectionRate;

    /** Distinct students who have at least one demand with balance > 0. */
    private long studentsWithDues;
}

