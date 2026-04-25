package com.myhaimi.sms.DTO;

import com.myhaimi.sms.entity.AttendanceMode;
import jakarta.validation.constraints.NotNull;

/** School-level attendance strategy (daily vs per lecture). */
public record AttendanceSettingsDTO(@NotNull AttendanceMode attendanceMode) {}
