package com.myhaimi.sms.DTO.fee;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Request body for POST /api/fees/payments — collect an offline fee payment.
 */
@Data
public class FeePaymentCreateRequestDTO {

    @NotNull(message = "studentId is required")
    private Integer studentId;

    @NotNull(message = "paymentDate is required")
    @PastOrPresent(message = "paymentDate cannot be in the future")
    private LocalDate paymentDate;

    @NotNull(message = "paymentMode is required")
    private String paymentMode;

    private String referenceNo;
    private String notes;

    @NotNull(message = "allocations are required")
    @NotEmpty(message = "at least one allocation is required")
    @Valid
    private List<AllocationItemDTO> allocations;

    @Data
    public static class AllocationItemDTO {
        @NotNull(message = "demandId is required")
        private Long demandId;

        @NotNull(message = "amount is required")
        @Positive(message = "allocated amount must be positive")
        private BigDecimal amount;
    }
}

