package com.myhaimi.sms.entity;

import com.myhaimi.sms.entity.enums.FeeType;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

/**
 * Represents a category/type of fee charged to students.
 * Acts as a master lookup; reused across multiple fee plans.
 *
 * <p>Code is unique per school. Once created, deactivate instead of delete
 * to preserve referential integrity in historical plan items and demands.</p>
 */
@Getter
@Setter
@Entity
@Table(
        name = "fee_heads",
        uniqueConstraints = @UniqueConstraint(columnNames = {"school_id", "code"})
)
public class FeeHead {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "school_id", nullable = false)
    private School school;

    /** Unique short code within the school (e.g. "TUI", "ADM"). */
    @Column(nullable = false, length = 32)
    private String code;

    @Column(nullable = false, length = 128)
    private String name;

    @Column(length = 512)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "fee_type", nullable = false, length = 32)
    private FeeType feeType;

    /** Whether this fee head is eligible for refunds (informational). */
    @Column(nullable = false)
    private boolean refundable = false;

    /** Whether students can opt out of this fee. */
    @Column(nullable = false)
    private boolean optional = false;

    /** Inactive heads cannot be added to new fee plan items. */
    @Column(nullable = false)
    private boolean active = true;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
