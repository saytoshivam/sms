package com.myhaimi.sms.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(
        name = "subject_allocations",
        uniqueConstraints = {@UniqueConstraint(
                name = "uq_subject_alloc_per_class_subject",
                columnNames = {"school_id", "class_group_id", "subject_id"})})
public class SubjectAllocation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "school_id", nullable = false)
    private School school;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "class_group_id", nullable = false)
    private ClassGroup classGroup;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "subject_id", nullable = false)
    private Subject subject;

    /** Optional: can be null during setup, assigned later. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "staff_id", nullable = true)
    private Staff staff;

    /** Default room for this class+subject (timetable); optional — falls back to class homeroom if null. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = true)
    private Room room;

    @Column(name = "weekly_frequency", nullable = false)
    private Integer weeklyFrequency;
}

