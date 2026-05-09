package com.myhaimi.sms.DTO.student;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;

@Data
public class StudentCoreCreateDTO {
    @NotBlank
    @Size(max = 64)
    private String admissionNo;

    @NotBlank
    @Size(max = 128)
    private String firstName;

    @Size(max = 128)
    private String middleName;

    @Size(max = 128)
    private String lastName;

    private LocalDate dateOfBirth;

    @Size(max = 16)
    private String gender;

    @Size(max = 16)
    private String bloodGroup;

    @Size(max = 512)
    private String photoUrl;

    @Size(max = 255)
    private String addressLine1;

    @Size(max = 255)
    private String addressLine2;

    @Size(max = 128)
    private String city;

    @Size(max = 128)
    private String state;

    @Size(max = 16)
    private String pincode;
}
