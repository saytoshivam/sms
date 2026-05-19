package com.myhaimi.sms.DTO.fee;

import com.myhaimi.sms.entity.enums.FeePlanStatus;
import lombok.Data;

import java.time.Instant;

@Data
public class FeePlanDTO {
    private Integer id;
    private Integer schoolId;
    private Integer academicYearId;
    private String academicYearLabel;
    private String name;
    private String description;
    private FeePlanStatus status;
    private Instant publishedAt;
    private Instant createdAt;
    private Instant updatedAt;
}
