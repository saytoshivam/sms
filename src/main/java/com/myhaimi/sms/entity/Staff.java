package com.myhaimi.sms.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;

import java.time.Instant;

@Data
@Entity
@Table(name = "staff", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"school_id", "employee_no"})
})
public class Staff {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "school_id", nullable = false)
    private School school;

    @Column(name = "employee_no", nullable = false, length = 64)
    private String employeeNo;

    @Column(nullable = false, length = 128)
    private String fullName;

    @Column(length = 64)
    private String designation; // Teacher, Accountant, etc.

    @Column(length = 32)
    private String phone;

    @Column(length = 128)
    private String email;

    /** Optional portrait URL (CDN / generated avatar). */
    @Column(name = "photo_url", length = 512)
    private String photoUrl;

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

    /**
     * Optional cap on total weekly <em>teaching</em> periods (sum of allocated weekly frequencies) for this staff member.
     * Used by onboarding smart assignment and load dashboards.
     */
    @Column(name = "max_weekly_lecture_load")
    private Integer maxWeeklyLectureLoad;

    /**
     * Optional JSON array of class_group ids the teacher prefers (soft preference in auto-assign).
     */
    @Column(name = "preferred_class_group_ids", columnDefinition = "json")
    private String preferredClassGroupIdsJson;

    public void setDeleted(boolean deleted) {
        this.isDeleted = deleted;
    }

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

