package com.myhaimi.sms.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "student_medical_infos")
public class StudentMedicalInfo {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @JsonIgnore
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false, unique = true)
    private Student student;

    @Column(length = 2048)
    private String allergies;

    @Column(name = "medical_conditions", length = 2048)
    private String medicalConditions;

    @Column(name = "emergency_contact_name", length = 128)
    private String emergencyContactName;

    @Column(name = "emergency_contact_phone", length = 32)
    private String emergencyContactPhone;

    @Column(name = "doctor_contact", length = 256)
    private String doctorContact;

    @Column(name = "medication_notes", length = 4096)
    private String medicationNotes;
}
