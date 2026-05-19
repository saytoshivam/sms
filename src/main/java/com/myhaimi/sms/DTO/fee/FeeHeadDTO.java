package com.myhaimi.sms.DTO.fee;

import com.myhaimi.sms.entity.enums.FeeType;
import lombok.Data;

import java.time.Instant;

@Data
public class FeeHeadDTO {
    private Integer id;
    private Integer schoolId;
    private String code;
    private String name;
    private String description;
    private FeeType feeType;
    private boolean refundable;
    private boolean optional;
    private boolean active;
    private Instant createdAt;
    private Instant updatedAt;
}
