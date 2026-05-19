package com.myhaimi.sms.entity.enums;

/**
 * Type of entry in the student fee ledger.
 *
 * <ul>
 *   <li>DEMAND           — fee demand raised (debit)</li>
 *   <li>PAYMENT          — offline payment received (credit)</li>
 *   <li>PAYMENT_CANCELLED — payment reversed after cancellation (debit)</li>
 *   <li>CONCESSION       — approved discount applied to a demand (credit) — future</li>
 *   <li>FINE             — late-payment or other fine added (debit) — future</li>
 *   <li>WAIVER           — full or partial waiver of a demand (credit) — future</li>
 *   <li>REFUND           — refund issued to student (debit) — future</li>
 *   <li>ADJUSTMENT       — manual corrective adjustment (debit or credit) — future</li>
 * </ul>
 */
public enum LedgerEntryType {
    DEMAND,
    PAYMENT,
    PAYMENT_CANCELLED,
    CONCESSION,
    FINE,
    WAIVER,
    REFUND,
    ADJUSTMENT
}

