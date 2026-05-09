package com.myhaimi.sms.DTO.student;

import lombok.Data;

@Data
public class StudentMedicalSummaryDTO {
    private String allergies;
    private String medicalConditions;
    private String emergencyContactName;
    private String emergencyContactPhone;
    private String doctorContact;
    private String medicationNotes;
}
