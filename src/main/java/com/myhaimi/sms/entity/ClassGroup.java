package com.myhaimi.sms.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Data;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Data
@Entity
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
@Table(name = "class_groups", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"school_id", "code"})
})
public class ClassGroup {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "school_id", nullable = false)
    private School school;

    /**
     * Unique per school: e.g. "10-A", "nursery-blue"
     */
    @Column(nullable = false, length = 64)
    private String code;

    @Column(nullable = false, length = 128)
    private String displayName;

    /** Grade / standard (1–12) for structured onboarding. Null for custom groups. */
    @Column(name = "grade_level")
    private Integer gradeLevel;

    /** Section label (A/B/C/...) for structured onboarding. Null for custom groups. */
    @Column(length = 16)
    private String section;

    /** Capacity hint for planning / fees; optional. */
    private Integer capacity;

    /** Homeroom / class teacher — required for {@link AttendanceMode#DAILY} authority checks. */
    @Getter(AccessLevel.NONE)
    @Setter
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "class_teacher_staff_id")
    private Staff classTeacher;

    @JsonIgnore
    public Staff getClassTeacher() {
        return classTeacher;
    }

    @JsonProperty("classTeacherStaffId")
    public Integer getClassTeacherStaffId() {
        return classTeacher == null ? null : classTeacher.getId();
    }

    @JsonProperty("classTeacherDisplayName")
    public String getClassTeacherDisplayName() {
        return classTeacher == null ? null : classTeacher.getFullName();
    }

    /** Optional default / homeroom room for this class (timetable, attendance context). */
    @Getter(AccessLevel.NONE)
    @Setter
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "default_room_id")
    private Room defaultRoom;

    @JsonIgnore
    public Room getDefaultRoom() {
        return defaultRoom;
    }

    @JsonProperty("defaultRoomId")
    public Integer getDefaultRoomId() {
        return defaultRoom == null ? null : defaultRoom.getId();
    }

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
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = Instant.now();
    }
}

