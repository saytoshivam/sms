package com.myhaimi.sms.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(
        name = "subject_class_mappings",
        uniqueConstraints = {@UniqueConstraint(columnNames = {"subject_id", "grade_level"})})
public class SubjectClassMapping {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "subject_id", nullable = false)
    private Subject subject;

    @Column(name = "grade_level", nullable = false)
    private Integer gradeLevel;

    @Column(name = "applies_to_all_sections", nullable = false)
    private Boolean appliesToAllSections = true;
}

