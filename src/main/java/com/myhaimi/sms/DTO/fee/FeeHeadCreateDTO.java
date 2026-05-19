package com.myhaimi.sms.DTO.fee;

import com.myhaimi.sms.entity.enums.FeeType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class FeeHeadCreateDTO {

    @NotBlank(message = "Code is required")
    @Size(max = 32, message = "Code must be 32 characters or less")
    private String code;

    @NotBlank(message = "Name is required")
    @Size(max = 128, message = "Name must be 128 characters or less")
    private String name;

    @Size(max = 512)
    private String description;

    @NotNull(message = "Fee type is required")
    private FeeType feeType;

    private boolean refundable = false;
    private boolean optional = false;
}
