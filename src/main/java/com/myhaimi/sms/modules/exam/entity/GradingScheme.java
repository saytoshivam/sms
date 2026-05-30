package com.myhaimi.sms.modules.exam.entity;

import com.myhaimi.sms.entity.AcademicYear;
import com.myhaimi.sms.entity.School;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * A named grading scheme (e.g. "CBSE 10-point scale") for a school/academic year.
 * Each school auto-seeds a default grading scheme on first use.
 */
@Getter
@Setter
@Entity
@Table(name = "grading_schemes", indexes = {
        @Index(name = "idx_gs_school", columnList = "school_id"),
        @Index(name = "idx_gs_academic_year", columnList = "academic_year_id")
})
public class GradingScheme {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "school_id", nullable = false)
    private School school;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "academic_year_id")
    private AcademicYear academicYear;

    @Column(nullable = false, length = 128)
    private String name;

    /** Whether this is the active/default scheme for the school. */
    @Column(nullable = false)
    private boolean active = true;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @OneToMany(mappedBy = "gradingScheme", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sequence ASC")
    private List<GradingBand> bands = new ArrayList<>();
}
