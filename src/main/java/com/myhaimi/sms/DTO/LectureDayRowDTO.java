package com.myhaimi.sms.DTO;

import java.time.LocalTime;

/** One lecture row for a class on a single day (timeline / conflict checks). */
public record LectureDayRowDTO(
        int id, LocalTime startTime, LocalTime endTime, String subject, String teacherName) {}
