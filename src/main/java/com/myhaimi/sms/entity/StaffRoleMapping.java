package com.myhaimi.sms.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * First-class staff role assignment.
 *
 * <p>A staff member may hold roles (e.g. TEACHER, HOD) independently of
 * whether they have a portal login account. This entity is the authoritative
 * source for staff roles; {@link User#getRoles()} is synchronised from here
 * when a login is provisioned.</p>
 *
 * <p>The combination of {@code staff_id + role_id} is unique — duplicate
 * assignments are prevented at the database level.</p>
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(
        name = "staff_role_mapping",
        uniqueConstraints = @UniqueConstraint(columnNames = {"staff_id", "role_id"})
)
public class StaffRoleMapping {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    /** Staff member who holds this role. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "staff_id", nullable = false)
    private Staff staff;

    /** Role granted to the staff member. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "role_id", nullable = false)
    private Role role;

    public StaffRoleMapping(Staff staff, Role role) {
        this.staff = staff;
        this.role  = role;
    }
}

