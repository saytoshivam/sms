package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.SchoolSequence;
import com.myhaimi.sms.entity.enums.SequenceType;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface SchoolSequenceRepository extends JpaRepository<SchoolSequence, Long> {

    /**
     * Fetches the sequence row with a pessimistic write-lock (SELECT … FOR UPDATE).
     * Callers must be inside an active transaction.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM SchoolSequence s WHERE s.schoolId = :schoolId AND s.sequenceType = :sequenceType")
    Optional<SchoolSequence> findLockedBySchoolIdAndSequenceType(
            @Param("schoolId")     Integer      schoolId,
            @Param("sequenceType") SequenceType sequenceType);

    Optional<SchoolSequence> findBySchoolIdAndSequenceType(Integer schoolId, SequenceType sequenceType);
}

