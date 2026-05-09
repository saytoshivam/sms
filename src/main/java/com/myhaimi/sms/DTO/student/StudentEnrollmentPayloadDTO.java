package com.myhaimi.sms.DTO.student;

import com.myhaimi.sms.entity.enums.StudentEnrollmentAdmissionCategory;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;

@Data
public class StudentEnrollmentPayloadDTO {
    /** When null, latest academic year for the tenant is used or bootstrapped. */
    private Integer academicYearId;

    @NotNull
    private Integer classGroupId;

    @Size(max = 32)
    private String rollNo;

    private LocalDate admissionDate;
    private LocalDate joiningDate;

    private StudentEnrollmentAdmissionCategory admissionCategory;
}
