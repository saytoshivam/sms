package com.myhaimi.sms.entity;

import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "guardians")
public class Guardian {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "school_id", nullable = false)
    private School school;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    @Column(nullable = false, length = 128)
    private String fullName;

    @Column(length = 32)
    private String relation; // Father, Mother, Guardian

    @Column(length = 32)
    private String phone;

    @Column(length = 128)
    private String email;
}

