package com.myhaimi.sms.DTO.fee;

import com.myhaimi.sms.entity.enums.LedgerEntryType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * A single line in a student's fee ledger.
 *
 * <p>Ledger is computed on-the-fly from existing demand, payment, and (future)
 * concession/fine/waiver records.  It is sorted chronologically and includes a
 * running balance after each entry.</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentFeeLedgerEntryDTO {

    /** Calendar date associated with the entry (demand due date, payment date, etc.). */
    private LocalDate date;

    /** Category of the ledger line. */
    private LedgerEntryType type;

    /**
     * Human-readable reference:
     * demand_no for DEMAND, receipt_no for PAYMENT / PAYMENT_CANCELLED, etc.
     */
    private String referenceNo;

    /** Free-text description of the entry. */
    private String description;

    /**
     * Amount that increases the student's outstanding balance (fee raised or fine).
     * Null / zero for credit-only entries.
     */
    private BigDecimal debit;

    /**
     * Amount that reduces the student's outstanding balance (payment, concession, waiver).
     * Null / zero for debit-only entries.
     */
    private BigDecimal credit;

    /** Running balance of the student's account after this entry. */
    private BigDecimal balanceAfter;

    /**
     * The entity type that produced this entry.
     * E.g. "StudentFeeDemand", "FeePayment", "FeePaymentAllocation".
     */
    private String sourceType;

    /** The primary-key id of the source entity. */
    private Long sourceId;
}

