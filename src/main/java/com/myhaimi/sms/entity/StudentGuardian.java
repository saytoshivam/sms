package com.myhaimi.sms.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "student_guardians", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"student_id", "guardian_id"})
})
public class StudentGuardian {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "guardian_id", nullable = false)
    private Guardian guardian;

    @Column(nullable = false, length = 64)
    private String relation;

    @Column(name = "is_primary", nullable = false)
    private boolean primaryGuardian;

    @Column(name = "can_login", nullable = false)
    private boolean canLogin;

    @Column(name = "receives_notifications", nullable = false)
    private boolean receivesNotifications = true;
}
