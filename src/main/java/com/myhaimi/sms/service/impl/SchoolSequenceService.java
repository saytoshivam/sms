package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.entity.SchoolSequence;
import com.myhaimi.sms.entity.enums.SequenceType;
import com.myhaimi.sms.repository.SchoolSequenceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * School-scoped, collision-safe sequence counter for financial document numbers.
 *
 * <p>The counter row is fetched with a {@code SELECT … FOR UPDATE} lock inside its own
 * {@link Propagation#REQUIRES_NEW} transaction so that concurrent requests block (not race) and
 * each gets a strictly unique value regardless of caller transaction boundaries.</p>
 *
 * <ul>
 *   <li>If no row exists for a {@code (schoolId, sequenceType)} pair it is created on first use
 *       (upsert-style, protected by the unique DB constraint).</li>
 *   <li>Never use {@code COUNT + 1} for financial documents — always call this service.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class SchoolSequenceService {

    private final SchoolSequenceRepository sequenceRepository;

    /**
     * Returns the next sequence value for the given school and type.
     * The internal counter is incremented atomically under a pessimistic write-lock.
     * Runs in its own transaction so the lock is released immediately after the increment.
     *
     * @param schoolId     tenant identifier
     * @param sequenceType document type namespace
     * @return strictly monotone positive value starting at 1
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public long nextValue(Integer schoolId, SequenceType sequenceType) {
        SchoolSequence seq = sequenceRepository
                .findLockedBySchoolIdAndSequenceType(schoolId, sequenceType)
                .orElseGet(() -> createNew(schoolId, sequenceType));

        long next = seq.getCurrentValue() + 1L;
        seq.setCurrentValue(next);
        sequenceRepository.save(seq);
        return next;
    }

    private SchoolSequence createNew(Integer schoolId, SequenceType sequenceType) {
        // A concurrent thread may have inserted the row between our empty-read and our insert;
        // if so, the save will throw a unique-key violation which will be retried by the caller.
        SchoolSequence s = new SchoolSequence();
        s.setSchoolId(schoolId);
        s.setSequenceType(sequenceType);
        s.setCurrentValue(0L);
        return sequenceRepository.save(s);
    }
}

