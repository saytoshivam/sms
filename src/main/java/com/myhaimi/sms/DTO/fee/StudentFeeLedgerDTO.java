package com.myhaimi.sms.DTO.fee;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

/**
 * Full ledger for a single student across all academic years.
 *
 * <p>The ledger is computed on-the-fly from existing demand and payment records.
 * It is NOT persisted — regenerate on every request (or cache at service level).</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentFeeLedgerDTO {

    private Integer studentId;
    private String  studentName;

    /**
     * Total of all debit entries (demands raised, fines, cancelled-payment reversals).
     * This is the total amount the student has been asked to pay historically.
     */
    private BigDecimal totalDebit;

    /**
     * Total of all credit entries (payments received, concessions, waivers).
     */
    private BigDecimal totalCredit;

    /**
     * Current outstanding balance = totalDebit - totalCredit.
     * Matches the last entry's {@code balanceAfter}.
     */
    private BigDecimal balance;

    /** Ordered ledger lines, oldest first. */
    private List<StudentFeeLedgerEntryDTO> entries;
}

