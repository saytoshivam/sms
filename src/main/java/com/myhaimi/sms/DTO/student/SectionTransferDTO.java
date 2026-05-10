package com.myhaimi.sms.DTO.student;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;

@Data
public class SectionTransferDTO {

    /** The academic year to transfer within (must match the active enrollment's year). */
    @NotNull
    private Integer academicYearId;

    /** Target class group. */
    @NotNull
    private Integer newClassGroupId;

    /** Optional new roll number in the target section. */
    @Size(max = 32)
    private String rollNo;

    /** When the student should start appearing in the new section. Defaults to today. */
    private LocalDate effectiveDate;

    @NotBlank
    @Size(max = 512)
    private String reason;
}
