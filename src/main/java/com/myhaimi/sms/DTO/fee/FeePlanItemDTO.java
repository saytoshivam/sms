package com.myhaimi.sms.DTO.fee;

import com.myhaimi.sms.entity.enums.ApplicableScopeType;
import com.myhaimi.sms.entity.enums.FeeFrequency;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@Data
public class FeePlanItemDTO {
    private Integer id;
    private Integer feePlanId;
    private Integer feeHeadId;
    private String feeHeadCode;
    private String feeHeadName;
    private ApplicableScopeType applicableScopeType;
    private Integer applicableScopeId;
    private BigDecimal amount;
    private FeeFrequency frequency;
    private boolean mandatory;
    private Instant createdAt;
    private Instant updatedAt;
    private List<FeeInstallmentDTO> installments;
}
