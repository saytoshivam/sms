package com.myhaimi.sms.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.myhaimi.sms.entity.enums.StudentLifecycleStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.time.LocalDate;

@Getter
@Setter
@Entity
@Table(name = "students", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"school_id", "admission_no"})
})
public class Student {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "school_id", nullable = false)
    private School school;

    /**
     * Denormalised current placement for timetable/attendance/portal lookups.
     * Kept aligned with {@link StudentAcademicEnrollment} for the active academic year when possible.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "class_group_id")
    private ClassGroup classGroup;

    @Column(name = "admission_no", nullable = false, length = 64)
    private String admissionNo;

    @Column(nullable = false, length = 128)
    private String firstName;

    @Column(name = "middle_name", length = 128)
    private String middleName;

    @Column(length = 128)
    private String lastName;

    private LocalDate dateOfBirth;

    @Column(length = 16)
    private String gender;

    @Column(name = "blood_group", length = 16)
    private String bloodGroup;

    @Column(length = 32)
    private String phone;

    @Column(length = 256)
    private String address;

    @Column(name = "photo_url", length = 512)
    private String photoUrl;

    /**
     * FK to file_objects.id — set after profile photo is uploaded via FileService.
     * photoUrl kept for backward compat with records that predate the file module.
     */
    @Column(name = "profile_photo_file_id", nullable = true)
    private Long profilePhotoFileId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private StudentLifecycleStatus status = StudentLifecycleStatus.ACTIVE;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
