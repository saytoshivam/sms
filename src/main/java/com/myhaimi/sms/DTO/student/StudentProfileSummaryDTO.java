package com.myhaimi.sms.DTO.student;

import com.myhaimi.sms.entity.enums.StudentLifecycleStatus;
import lombok.Data;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Data
public class StudentProfileSummaryDTO {

    private Integer id;
    private String admissionNo;
    private String firstName;
    private String middleName;
    private String lastName;
    private LocalDate dateOfBirth;
    private String gender;
    private String bloodGroup;
    private String photoUrl;
    private StudentLifecycleStatus status;
    private Integer classGroupId;
    private String classGroupDisplayName;
    private String phone;
    private String address;
    private Instant createdAt;
    private Instant updatedAt;

    private StudentEnrollmentSummaryDTO currentEnrollment;

    private List<StudentEnrollmentSummaryDTO> enrollmentHistory;

    private List<GuardianSummaryDTO> guardians;

    private StudentMedicalSummaryDTO medical;

    private List<StudentDocumentSummaryDTO> documents;
}
