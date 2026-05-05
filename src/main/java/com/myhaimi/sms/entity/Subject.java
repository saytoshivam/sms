package com.myhaimi.sms.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Data
@Entity
@Table(name = "subjects", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"school_id", "code"})
})
public class Subject {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "school_id", nullable = false)
    private School school;

    @Column(nullable = false, length = 32)
    private String code;

    @Column(nullable = false, length = 128)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private SubjectType type = SubjectType.CORE;

    /**
     * Which physical room categories may host this subject (never inferred from name).
     */
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "allocation_venue_requirement", nullable = false, length = 32)
    private SubjectAllocationVenueRequirement allocationVenueRequirement = SubjectAllocationVenueRequirement.STANDARD_CLASSROOM;

    /**
     * When {@link #allocationVenueRequirement} is {@link SubjectAllocationVenueRequirement#SPECIALIZED_ROOM},
     * the intended {@link RoomType} for that specialty (optional; MULTIPURPOSE remains a fallback).
     */
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "specialized_venue_type", length = 32)
    private RoomType specializedVenueType;

    /**
     * Weekly frequency hint for timetable generation (e.g. 4 periods/week).
     */
    @Column(name = "weekly_frequency")
    private Integer weeklyFrequency;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "created_by")
    private String createdBy;

    @Column(name = "updated_by")
    private String updatedBy;

    @Column(name = "is_deleted", nullable = false)
    private boolean isDeleted = false;

    @PrePersist
    public void prePersist() {
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
        if (allocationVenueRequirement == null) {
            allocationVenueRequirement = SubjectAllocationVenueRequirement.STANDARD_CLASSROOM;
        }
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = Instant.now();
    }
}

