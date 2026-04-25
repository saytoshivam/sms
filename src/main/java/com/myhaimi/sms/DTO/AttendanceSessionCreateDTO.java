package com.myhaimi.sms.DTO;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;

@Data
public class AttendanceSessionCreateDTO {
    @NotNull
    private Integer classGroupId;

    @NotNull
    private LocalDate date;

    /** Required when the school uses lecture-wise attendance ({@code lectureId} must match class + date). */
    private Integer lectureId;
}

