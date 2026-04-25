package com.myhaimi.sms.DTO;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class FeePaymentCreateDTO {
    @NotNull
    private BigDecimal amount;

    @NotNull
    private LocalDateTime paidAt;

    private String method;
    private String reference;
}

