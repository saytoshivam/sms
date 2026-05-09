package com.myhaimi.sms.DTO.attendance;

import java.time.LocalTime;
import java.util.List;

public record AdminDailyAttendanceBoardDTO(
        /** School-wide daily submission cutoff (local wall-clock); null means no cutoff configured. */
        LocalTime dailyCutoffLocalTime,
        List<AdminDailySectionRowDTO> sections) {}
