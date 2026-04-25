package com.myhaimi.sms.DTO;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record OnboardingFeesSetupDTO(
        @NotEmpty List<ClassFeeDTO> classFees,
        @NotEmpty List<InstallmentDTO> installments,
        LateFeeRuleDTO lateFeeRule
) {
    public record ClassFeeDTO(@NotNull Integer classGroupId, @NotNull Integer totalAmount) {}

    /** Percent split must sum to 100 across installments. */
    public record InstallmentDTO(@NotNull String label, @NotNull String dueDateIso, @NotNull Integer percent) {}

    public record LateFeeRuleDTO(Integer graceDays, Integer lateFeePerDay) {}
}

