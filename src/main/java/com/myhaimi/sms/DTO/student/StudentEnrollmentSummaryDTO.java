package com.myhaimi.sms.DTO.student;

import com.myhaimi.sms.entity.enums.StudentAcademicEnrollmentStatus;
import lombok.Data;

import java.time.LocalDate;

@Data
public class StudentEnrollmentSummaryDTO {
    private Integer id;
    private Integer academicYearId;
    private String academicYearLabel;
    private Integer classGroupId;
    private String classGroupDisplayName;
    private String rollNo;
    private LocalDate admissionDate;
    private LocalDate joiningDate;
    private StudentAcademicEnrollmentStatus status;
}
