package com.myhaimi.sms.DTO.student;

import com.myhaimi.sms.entity.enums.StudentLifecycleStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;

@Data
public class StudentUpdateDTO {

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

    @Size(max = 32)
    private String phone;

    @Size(max = 256)
    private String address;

    /** When set to ACTIVE, an active enrollment must already exist for the learner. */
    private StudentLifecycleStatus status;
}
