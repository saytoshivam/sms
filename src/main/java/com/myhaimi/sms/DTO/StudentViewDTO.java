package com.myhaimi.sms.DTO;

import com.myhaimi.sms.entity.enums.StudentLifecycleStatus;
import lombok.Data;

import java.time.Instant;
import java.time.LocalDate;

@Data
public class StudentViewDTO {
    private Integer id;
    private String admissionNo;
    private String firstName;
    private String middleName;
    private String lastName;
    private LocalDate dateOfBirth;
    private String gender;
    private String bloodGroup;
    private String phone;
    private String address;

    private String photoUrl;

    private Integer classGroupId;
    private String classGroupCode;
    private String classGroupDisplayName;
    private Integer classGroupGradeLevel;
    private String classGroupSection;

    /** Roll number for the latest academic year enrollment at this school, when present. */
    private String rollNo;

    private String primaryGuardianName;
    private String primaryGuardianPhone;

    private int documentVerifiedCount;
    private int documentPendingCount;

    private StudentLifecycleStatus status;

    private Instant createdAt;
    private Instant updatedAt;
}

