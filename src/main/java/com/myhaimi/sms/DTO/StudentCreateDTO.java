package com.myhaimi.sms.DTO;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;

@Data
public class StudentCreateDTO {
    @NotBlank
    private String admissionNo;

    @NotBlank
    private String firstName;

    private String lastName;
    private LocalDate dateOfBirth;
    private String gender;
    private String phone;
    private String address;

    private Integer classGroupId;

    /** Optional portrait URL (HTTPS image or school CDN). */
    @Size(max = 512)
    private String photoUrl;
}

