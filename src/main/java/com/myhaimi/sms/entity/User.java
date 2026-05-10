package com.myhaimi.sms.entity;
import jakarta.persistence.*;
import lombok.Data;
import java.util.*;

@Data
@Entity
@Table(name = "users", uniqueConstraints = @UniqueConstraint(columnNames = "email"))
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private int id;
    @Column(name = "username", nullable = false , unique = true)
    private String username;
    private String password;
    @Column(nullable = false, unique = true)
    private String email;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "school_id")
    private School school;

    /** When set, this login maps to a student profile (parent portal / student app). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "linked_student_id")
    private Student linkedStudent;

    /** When set, this login maps to a staff/teacher row (timetable + class views). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "linked_staff_id")
    private Staff linkedStaff;

    /** When set, this login belongs to a parent/guardian. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "linked_guardian_id")
    private Guardian linkedGuardian;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
            name = "user_roles",
            joinColumns = @JoinColumn(name = "user_id"),
            inverseJoinColumns = @JoinColumn(name = "role_id")
    )
    private Set<Role> roles = new HashSet<>();
}
