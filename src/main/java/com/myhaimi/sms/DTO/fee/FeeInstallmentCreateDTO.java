package com.myhaimi.sms.DTO.fee;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
public class FeeInstallmentCreateDTO {

    /** Batch create: list of installments to replace the existing schedule for a plan item. */
    @NotNull
    private List<InstallmentEntry> installments;

    @Data
    public static class InstallmentEntry {

        @NotBlank(message = "Installment name is required")
        @Size(max = 128)
        private String name;

        @NotNull(message = "Due date is required")
        private LocalDate dueDate;

        @NotNull(message = "Amount is required")
        @DecimalMin(value = "0.01", message = "Amount must be greater than 0")
        private BigDecimal amount;

        /** 1-based sequence; if not provided, list order is used. */
        private Integer sequence;
    }
}
