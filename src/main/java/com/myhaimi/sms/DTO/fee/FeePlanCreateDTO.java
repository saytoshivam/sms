package com.myhaimi.sms.DTO.fee;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class FeePlanCreateDTO {

    @NotNull(message = "Academic year is required")
    private Integer academicYearId;

    @NotBlank(message = "Name is required")
    @Size(max = 128)
    private String name;

    @Size(max = 512)
    private String description;
}
