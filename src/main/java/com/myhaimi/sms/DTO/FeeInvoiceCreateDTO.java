package com.myhaimi.sms.DTO;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class FeeInvoiceCreateDTO {
    @NotNull
    private Integer studentId;

    @NotNull
    private BigDecimal amountDue;

    @NotNull
    private LocalDate dueDate;
}

