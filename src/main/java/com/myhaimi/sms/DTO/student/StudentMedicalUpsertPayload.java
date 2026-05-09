package com.myhaimi.sms.DTO.student;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class StudentMedicalUpsertPayload {

    @Size(max = 2048)
    private String allergies;

    @Size(max = 2048)
    private String medicalConditions;

    @Size(max = 128)
    private String emergencyContactName;

    @Size(max = 32)
    private String emergencyContactPhone;

    @Size(max = 256)
    private String doctorContact;

    @Size(max = 4096)
    private String medicationNotes;
}
