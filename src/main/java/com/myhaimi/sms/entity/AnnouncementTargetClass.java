package com.myhaimi.sms.entity;

import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(
        name = "announcement_target_classes",
        uniqueConstraints = @UniqueConstraint(columnNames = {"announcement_id", "class_group_id"})
)
public class AnnouncementTargetClass {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "announcement_id", nullable = false)
    private Announcement announcement;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "class_group_id", nullable = false)
    private ClassGroup classGroup;
}
