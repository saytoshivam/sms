package com.myhaimi.sms.DTO.fee;

import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Data
public class FeeInstallmentDTO {
    private Integer id;
    private Integer feePlanItemId;
    private String name;
    private LocalDate dueDate;
    private BigDecimal amount;
    private int sequence;
    private Instant createdAt;
    private Instant updatedAt;
}
