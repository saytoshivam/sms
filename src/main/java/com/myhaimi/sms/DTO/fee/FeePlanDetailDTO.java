package com.myhaimi.sms.DTO.fee;

import lombok.Data;

import java.util.List;

/** Rich view of a fee plan including its items and installments. */
@Data
public class FeePlanDetailDTO {
    private FeePlanDTO plan;
    private List<FeePlanItemDTO> items;
}
