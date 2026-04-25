package com.myhaimi.sms.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(
        name = "class_subject_configs",
        uniqueConstraints = {@UniqueConstraint(
                name = "uq_class_subject_cfg",
                columnNames = {"school_id", "grade_level", "subject_id"})})
public class ClassSubjectConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "school_id", nullable = false)
    private School school;

    /** Grade-level template, e.g. 6 for all grade-6 sections. */
    @Column(name = "grade_level", nullable = false)
    private Integer gradeLevel;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "subject_id", nullable = false)
    private Subject subject;

    @Column(name = "default_periods_per_week", nullable = false)
    private Integer defaultPeriodsPerWeek;

    /** Optional default teacher for this class+subject template. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "staff_id", nullable = true)
    private Staff staff;

    /** Optional default room for this class+subject template. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = true)
    private Room room;
}

