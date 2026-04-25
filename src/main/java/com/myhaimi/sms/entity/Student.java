package com.myhaimi.sms.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.time.LocalDate;

@Data
@Entity
@Table(name = "students", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"school_id", "admission_no"})
})
public class Student {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "school_id", nullable = false)
    private School school;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "class_group_id")
    private ClassGroup classGroup;

    @Column(name = "admission_no", nullable = false, length = 64)
    private String admissionNo;

    @Column(nullable = false, length = 128)
    private String firstName;

    @Column(length = 128)
    private String lastName;

    private LocalDate dateOfBirth;

    @Column(length = 16)
    private String gender;

    @Column(length = 32)
    private String phone;

    @Column(length = 256)
    private String address;

    /** Optional portrait URL (CDN / generated avatar). */
    @Column(name = "photo_url", length = 512)
    private String photoUrl;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;
}

