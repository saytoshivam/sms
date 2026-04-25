package com.myhaimi.sms.DTO;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class AttendanceMarkDTO {
    @NotNull
    private Integer studentId;

    @NotBlank
    private String status; // PRESENT, ABSENT, LATE, EXCUSED

    private String remark;
}

