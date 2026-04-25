package com.myhaimi.sms.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(
        name = "subject_section_overrides",
        uniqueConstraints = {@UniqueConstraint(columnNames = {"subject_id", "class_group_id"})})
public class SubjectSectionOverride {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "subject_id", nullable = false)
    private Subject subject;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "class_group_id", nullable = false)
    private ClassGroup classGroup;

    /** Nullable: if null, fall back to class-level default periods. */
    @Column(name = "periods_per_week", nullable = true)
    private Integer periodsPerWeek;

    /** Nullable: if null, fall back to class-level default teacher. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "staff_id", nullable = true)
    private Staff staff;

    /** Nullable: if null, fall back to class-level default room (or homeroom). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = true)
    private Room room;
}

