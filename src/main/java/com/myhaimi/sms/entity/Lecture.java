package com.myhaimi.sms.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Data;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;

@Data
@Entity
@Table(name = "lectures")
public class Lecture {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "school_id", nullable = false)
    private School school;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "class_group_id", nullable = false)
    private ClassGroup classGroup;

    @Column(nullable = false)
    private LocalDate date;

    @Column(nullable = false)
    private LocalTime startTime;

    @Column(nullable = false)
    private LocalTime endTime;

    @Column(nullable = false, length = 128)
    private String subject;

    @Column(length = 128)
    private String teacherName;

    /** When the lecture was created by a staff-linked login, ties RBAC for lecture-wise attendance. */
    @Getter(AccessLevel.NONE)
    @Setter
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "staff_id")
    private Staff staff;

    @Column(length = 256)
    private String room;

    @JsonIgnore
    public Staff getStaff() {
        return staff;
    }

    @JsonProperty("staffId")
    public Integer getStaffId() {
        return staff == null ? null : staff.getId();
    }

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;
}

