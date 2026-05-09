package com.myhaimi.sms.DTO.studentportal;

import java.time.LocalDate;

public record StudentDailyAttendanceRowDTO(LocalDate date, String status, boolean lockedRoll) {}
