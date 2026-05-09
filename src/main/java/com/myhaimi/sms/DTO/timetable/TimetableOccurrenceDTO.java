package com.myhaimi.sms.DTO.timetable;

import com.fasterxml.jackson.annotation.JsonFormat;

import java.time.LocalDate;
import java.time.LocalTime;

public record TimetableOccurrenceDTO(
        @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd") LocalDate date,
        @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "HH:mm") LocalTime startTime,
        @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "HH:mm") LocalTime endTime,
        String subject,
        String teacherName,
        String room,
        String classGroupDisplayName,
        /** {@code RECURRING} from weekly slots; {@code AD_HOC} from scheduled lecture rows. */
        String source,
        Integer classGroupId,
        /**
         * When non-null: same encoding as lecture-day rows — positive {@link com.myhaimi.sms.entity.Lecture#getId()};
         * negative −{@link com.myhaimi.sms.entity.TimetableEntry#getId()} from published timetable, or −(base+slot id) for legacy weekly slots.
         */
        Integer lectureRowId) {}
