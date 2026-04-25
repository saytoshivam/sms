package com.myhaimi.sms.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalTime;

@Data
@Entity
@Table(
        name = "school_time_slots",
        uniqueConstraints = {@UniqueConstraint(columnNames = {"school_id", "slot_order"})})
public class SchoolTimeSlot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "school_id", nullable = false)
    private School school;

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;

    @Column(name = "slot_order", nullable = false)
    private Integer slotOrder;

    @Column(name = "is_break", nullable = false)
    private boolean breakSlot = false;

    @Column(nullable = false)
    private boolean active = true;
}

