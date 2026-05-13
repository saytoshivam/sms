package com.myhaimi.sms.entity;
import jakarta.persistence.*;
import lombok.Data;
import java.time.Instant;
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

    /**
     * Admin-controlled flag. When false the user cannot authenticate.
     * True by default; set to false via disable-login action.
     */
    @Column(nullable = false)
    private boolean enabled = true;

    /**
     * Timestamp of the last invite/welcome action (no email service yet — tracked for auditing).
     */
    @Column(name = "last_invite_sent_at")
    private Instant lastInviteSentAt;

    /**
     * True when an invite has been recorded via the send-invite action and the
     * account has not yet been explicitly activated or disabled.
     * Drives the INVITED login-status state in {@code StaffAccessService}.
     */
    @Column(name = "invite_pending", nullable = false)
    private boolean invitePending = false;

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
