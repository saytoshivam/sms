package com.myhaimi.sms.DTO;

import lombok.Data;

import java.time.Instant;
import java.time.LocalDate;

@Data
public class StudentViewDTO {
    private Integer id;
    private String admissionNo;
    private String firstName;
    private String lastName;
    private LocalDate dateOfBirth;
    private String gender;
    private String phone;
    private String address;

    private String photoUrl;

    private Integer classGroupId;
    private String classGroupDisplayName;

    private Instant createdAt;
}

