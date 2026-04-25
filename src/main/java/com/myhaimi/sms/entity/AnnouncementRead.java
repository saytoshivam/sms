package com.myhaimi.sms.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Data
@Entity
@Table(
        name = "announcement_reads",
        uniqueConstraints = @UniqueConstraint(columnNames = {"student_id", "announcement_id"})
)
public class AnnouncementRead {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "announcement_id", nullable = false)
    private Announcement announcement;

    @CreationTimestamp
    @Column(name = "read_at", nullable = false, updatable = false)
    private Instant readAt;
}
