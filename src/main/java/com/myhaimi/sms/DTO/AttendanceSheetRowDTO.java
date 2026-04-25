package com.myhaimi.sms.DTO;

import lombok.Data;

@Data
public class AttendanceSheetRowDTO {
    private Integer studentId;
    private String admissionNo;
    private String displayName;
    /** {@code PRESENT}, {@code ABSENT}, or {@code null} if not marked yet. */
    private String status;
}
