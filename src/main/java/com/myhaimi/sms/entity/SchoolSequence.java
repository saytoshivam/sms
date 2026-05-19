package com.myhaimi.sms.entity;

import com.myhaimi.sms.entity.enums.SequenceType;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

/**
 * School-scoped sequence counter for financial document numbers (fee demands, receipts, etc.).
 *
 * <p>Each row owns one monotone counter per {@code (school_id, sequence_type)}.
 * Use {@link com.myhaimi.sms.service.impl.SchoolSequenceService#nextValue(Integer, SequenceType)}
 * with a pessimistic write-lock to guarantee collision-free increments under concurrency.</p>
 */
@Getter
@Setter
@Entity
@Table(
        name = "school_sequences",
        uniqueConstraints = @UniqueConstraint(columnNames = {"school_id", "sequence_type"})
)
public class SchoolSequence {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "school_id", nullable = false)
    private Integer schoolId;

    @Enumerated(EnumType.STRING)
    @Column(name = "sequence_type", nullable = false, length = 32)
    private SequenceType sequenceType;

    @Column(name = "current_value", nullable = false)
    private long currentValue = 0L;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}

