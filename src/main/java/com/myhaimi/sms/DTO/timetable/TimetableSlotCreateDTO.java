package com.myhaimi.sms.DTO.timetable;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.DayOfWeek;
import java.time.LocalTime;

@Data
public class TimetableSlotCreateDTO {

    @NotNull
    private Integer classGroupId;

    /** Optional link to a staff member teaching this slot. */
    private Integer staffId;

    private String teacherDisplayName;

    @NotBlank
    private String subject;

    @NotNull
    private DayOfWeek dayOfWeek;

    @NotNull
    private LocalTime startTime;

    @NotNull
    private LocalTime endTime;

    private String room;

    private Boolean active = true;
}
