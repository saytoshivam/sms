package com.myhaimi.sms.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;

/** Staff capability: which school subjects this staff member is allowed to teach. */
@Data
@Entity
@Table(
        name = "staff_teachable_subjects",
        uniqueConstraints = @UniqueConstraint(name = "uq_staff_teachable", columnNames = {"staff_id", "subject_id"}))
public class StaffTeachableSubject {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "staff_id", nullable = false)
    private Staff staff;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "subject_id", nullable = false)
    private Subject subject;
}
