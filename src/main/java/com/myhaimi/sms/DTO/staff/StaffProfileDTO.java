package com.myhaimi.sms.DTO.staff;

import com.myhaimi.sms.entity.enums.EmploymentType;
import com.myhaimi.sms.entity.enums.SalaryType;
import com.myhaimi.sms.entity.enums.StaffStatus;
import com.myhaimi.sms.entity.enums.StaffType;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDate;
import java.util.List;

/**
 * Full staff profile — returned from detail / profile endpoints.
 *
 * <p>Sensitive fields ({@code bankAccountNumber}, {@code panNumber}) are
 * masked before transmission:
 * <ul>
 *   <li>bankAccountNumber — last 4 digits visible: {@code ****1234}</li>
 *   <li>panNumber         — first 2 and last 1 chars visible: {@code AB*******C}</li>
 * </ul>
 * Never set these from the raw entity fields directly; always go through
 * {@link #maskBankAccount(String)} / {@link #maskPan(String)}.
 */
@Data
@EqualsAndHashCode(callSuper = true)
public class StaffProfileDTO extends StaffSummaryDTO {

    private String gender;
    private LocalDate dateOfBirth;
    private String alternatePhone;

    // Reporting structure
    private Integer reportingManagerStaffId;

    // Address
    private String currentAddressLine1;
    private String currentAddressLine2;
    private String city;
    private String state;
    private String pincode;

    // Emergency contact
    private String emergencyContactName;
    private String emergencyContactPhone;
    private String emergencyContactRelation;

    // Qualifications
    private String highestQualification;
    private String professionalQualification;
    private String previousInstitution;

    // ── Payroll (masked) ──────────────────────────────────────────────────────
    private SalaryType salaryType;
    private boolean    payrollEnabled;
    private String     bankAccountHolderName;
    private String     bankName;
    /** Always masked — last 4 digits only. */
    private String     bankAccountNumberMasked;
    private String     ifsc;
    /** Always masked — first 2 and last 1 chars only. */
    private String     panNumberMasked;

    // ── Profile completeness summary ───────────────────────────────────────────

    /**
     * Weighted profile completeness breakdown.
     * {@code percentComplete} is the weighted sum across all categories.
     * {@code categories} contains one entry per completeness dimension.
     * Legacy flat fields kept for backward compatibility.
     */
    private ProfileCompleteness profileCompleteness;

    /** Weighted profile-completeness snapshot. */
    public record ProfileCompleteness(
            /** Overall weighted percentage (0–100). */
            int percentComplete,
            /** Per-category breakdown. */
            List<CategoryScore> categories,
            /** Legacy: number of categories whose score ≥ 50. */
            int filledSections,
            /** Legacy: total category count. */
            int totalSections,
            /** Legacy: names of categories with score < 50. */
            List<String> emptySections
    ) {
        /**
         * Score for a single completeness dimension.
         *
         * @param id      machine-readable identifier (e.g. "identity")
         * @param name    human-readable label
         * @param icon    emoji for the UI
         * @param weight  weight out of 100 in the overall score
         * @param score   category score 0–100
         * @param missing human-readable list of missing / incomplete items
         */
        public record CategoryScore(
                String id,
                String name,
                String icon,
                int weight,
                int score,
                List<String> missing
        ) {}
    }

    // ── Masking helpers ────────────────────────────────────────────────────────

    /**
     * Masks a bank account number, keeping only the last 4 digits.
     * Returns null when the input is blank.
     */
    public static String maskBankAccount(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String digits = raw.replaceAll("\\s", "");
        if (digits.length() <= 4) return "****";
        return "*".repeat(digits.length() - 4) + digits.substring(digits.length() - 4);
    }

    /**
     * Masks a PAN number, keeping only the first 2 and last 1 characters.
     * Returns null when the input is blank.
     */
    public static String maskPan(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String s = raw.trim();
        if (s.length() <= 3) return "*".repeat(s.length());
        return s.substring(0, 2) + "*".repeat(s.length() - 3) + s.charAt(s.length() - 1);
    }
}


