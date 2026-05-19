package com.myhaimi.sms.DTO.fee;

import com.myhaimi.sms.entity.enums.ApplicableScopeType;
import com.myhaimi.sms.entity.enums.FeeFrequency;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class FeePlanItemCreateDTO {

    @NotNull(message = "Fee head is required")
    private Integer feeHeadId;

    @NotNull(message = "Applicable scope type is required")
    private ApplicableScopeType applicableScopeType;

    @NotNull(message = "Applicable scope ID is required")
    private Integer applicableScopeId;

    @NotNull(message = "Amount is required")
    @DecimalMin(value = "0.01", message = "Amount must be greater than 0")
    private BigDecimal amount;

    @NotNull(message = "Frequency is required")
    private FeeFrequency frequency;

    private boolean mandatory = true;
}
