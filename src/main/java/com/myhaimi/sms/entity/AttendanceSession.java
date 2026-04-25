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

@Data
@Entity
@Table(name = "attendance_sessions")
public class AttendanceSession {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "school_id", nullable = false)
    private School school;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "class_group_id", nullable = false)
    private ClassGroup classGroup;

    @Column(nullable = false)
    private LocalDate date;

    /**
     * When set, marks for this session apply to that lecture only (lecture-wise mode). Null means a full-day session
     * (daily mode).
     */
    @Getter(AccessLevel.NONE)
    @Setter
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lecture_id")
    private Lecture lecture;

    @JsonIgnore
    public Lecture getLecture() {
        return lecture;
    }

    @Column(name = "dedupe_key", nullable = false, unique = true, length = 96)
    private String dedupeKey;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @JsonProperty("lectureId")
    public Integer getLectureId() {
        return lecture == null ? null : lecture.getId();
    }
}
