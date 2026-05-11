package com.myhaimi.sms.DTO.staff.onboarding;

import com.myhaimi.sms.entity.enums.SalaryType;
import lombok.Data;

/**
 * Payroll setup — all fields optional; bank details are stored encrypted at rest
 * and always masked in API responses.
 */
@Data
public class StaffPayrollSetupDTO {

    private boolean payrollEnabled = false;

    private SalaryType salaryType;

    // ── Bank details ───────────────────────────────────────────────────────────
    private String bankAccountHolderName;
    private String bankName;

    /**
     * Full account number — stored internally, never returned in API responses.
     * API responses show only the masked form (last 4 digits).
     */
    private String bankAccountNumber;

    /** IFSC code of the branch (11-char alphanumeric format for Indian banks). */
    private String ifsc;

    /**
     * PAN card number — stored internally, never returned in API responses.
     * API responses show only the masked form (first 2 + last 1 chars).
     */
    private String panNumber;
}
