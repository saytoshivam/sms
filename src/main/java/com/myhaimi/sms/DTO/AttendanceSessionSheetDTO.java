package com.myhaimi.sms.DTO;

import lombok.Data;

import java.time.LocalDate;
import java.util.List;

@Data
public class AttendanceSessionSheetDTO {
    private Integer sessionId;
    private LocalDate date;
    private String classGroupDisplayName;
    private Integer lectureId;
    /** e.g. {@code 09:00–10:00 · Mathematics}; null for daily / unlinked lecture. */
    private String lectureSummary;
    private boolean locked;

    /** For lecture-wise: whether this period is inside start→end+grace (non-leaders). */
    private boolean markingWindowOpenNow;

    private List<AttendanceSheetRowDTO> students;
}
