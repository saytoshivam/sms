package com.myhaimi.sms.modules.exam.entity;

import com.myhaimi.sms.entity.ClassGroup;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Getter
@Setter
@Entity
@Table(name = "grading_scheme_class_assignments", indexes = {
        @Index(name = "idx_gsca_scheme", columnList = "grading_scheme_id"),
        @Index(name = "idx_gsca_class_group", columnList = "class_group_id")
})
public class GradingSchemeClassAssignment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "grading_scheme_id", nullable = false)
    private GradingScheme gradingScheme;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "class_group_id", nullable = false)
    private ClassGroup classGroup;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
