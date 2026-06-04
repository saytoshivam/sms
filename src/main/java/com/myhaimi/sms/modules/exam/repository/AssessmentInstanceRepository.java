package com.myhaimi.sms.modules.exam.repository;

import com.myhaimi.sms.modules.exam.entity.AssessmentInstance;
import com.myhaimi.sms.modules.exam.entity.enums.AssessmentInstanceStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

public interface AssessmentInstanceRepository extends JpaRepository<AssessmentInstance, Integer> {

    Optional<AssessmentInstance> findByIdAndSchool_Id(Integer id, Integer schoolId);

    List<AssessmentInstance> findBySchool_IdAndAcademicYear_IdAndClassGroup_IdAndSubject_IdOrderByAssessmentDateAscSequenceAsc(
            Integer schoolId, Integer academicYearId, Integer classGroupId, Integer subjectId);

    List<AssessmentInstance> findByScheme_IdAndComponent_IdOrderByClassGroup_IdAscSubject_IdAscSequenceAsc(
            Integer schemeId, Integer componentId);

    List<AssessmentInstance> findByScheme_IdOrderByClassGroup_IdAscSubject_IdAscSequenceAsc(Integer schemeId);

    // Used by upcoming teacher-assignment derivation (subject/class scoped view).
    List<AssessmentInstance> findBySchool_IdAndClassGroup_IdInAndSubject_IdInOrderByAssessmentDateAscSequenceAsc(
            Integer schoolId,
            List<Integer> classGroupIds,
            List<Integer> subjectIds
    );

    boolean existsBySchool_IdAndComponent_IdAndClassGroup_IdAndSubject_IdAndNameIgnoreCase(
            Integer schoolId, Integer componentId, Integer classGroupId, Integer subjectId, String name);

    boolean existsBySchool_IdAndComponent_IdAndClassGroup_IdAndSubject_IdAndNameIgnoreCaseAndIdNot(
            Integer schoolId, Integer componentId, Integer classGroupId, Integer subjectId, String name, Integer id);

    long countBySchool_IdAndComponent_IdAndClassGroup_IdAndSubject_IdAndStatusNot(
            Integer schoolId,
            Integer componentId,
            Integer classGroupId,
            Integer subjectId,
            AssessmentInstanceStatus status
    );

    /**
     * Detect duplicate: another row for same class-section + subject + component
     * that is already in the target published status.
     */
    boolean existsBySchool_IdAndClassGroup_IdAndSubject_IdAndComponent_IdAndStatusAndIdNot(
            Integer schoolId,
            Integer classGroupId,
            Integer subjectId,
            Integer componentId,
            AssessmentInstanceStatus status,
            Integer excludeId
    );

    /**
     * Detect class-section time conflict: another exam for the same class on the same
     * date where time windows overlap (exclusive overlap: startA < endB && endA > startB).
     */
    @Query("""
            select count(ai) from AssessmentInstance ai
            where ai.school.id = :schoolId
              and ai.classGroup.id = :classGroupId
              and ai.assessmentDate = :date
              and ai.startTime is not null
              and ai.endTime is not null
              and ai.status not in :excludedStatuses
              and ai.id <> :excludeId
              and ai.startTime < :endTime
              and ai.endTime > :startTime
            """)
    long countOverlappingByClassTime(
            @Param("schoolId") Integer schoolId,
            @Param("classGroupId") Integer classGroupId,
            @Param("date") LocalDate date,
            @Param("startTime") LocalTime startTime,
            @Param("endTime") LocalTime endTime,
            @Param("excludeId") Integer excludeId,
            @Param("excludedStatuses") List<AssessmentInstanceStatus> excludedStatuses
    );

    /**
     * Detect room double-booking: another exam in the same room on the same date with overlapping time.
     */
    @Query("""
            select count(ai) from AssessmentInstance ai
            where ai.school.id = :schoolId
              and ai.room.id = :roomId
              and ai.assessmentDate = :date
              and ai.startTime is not null
              and ai.endTime is not null
              and ai.status not in :excludedStatuses
              and ai.id <> :excludeId
              and ai.startTime < :endTime
              and ai.endTime > :startTime
            """)
    long countOverlappingByRoom(
            @Param("schoolId") Integer schoolId,
            @Param("roomId") Integer roomId,
            @Param("date") LocalDate date,
            @Param("startTime") LocalTime startTime,
            @Param("endTime") LocalTime endTime,
            @Param("excludeId") Integer excludeId,
            @Param("excludedStatuses") List<AssessmentInstanceStatus> excludedStatuses
    );

    @Query("""
            select ai from AssessmentInstance ai
            where ai.school.id = :schoolId
              and (:academicYearId is null or ai.academicYear.id = :academicYearId)
              and (:classGroupId is null or ai.classGroup.id = :classGroupId)
              and (:subjectId is null or ai.subject.id = :subjectId)
              and (:schemeId is null or ai.scheme.id = :schemeId)
              and (:componentId is null or ai.component.id = :componentId)
            order by case when ai.assessmentDate is null then 1 else 0 end,
                     ai.assessmentDate asc,
                     ai.sequence asc,
                     ai.createdAt asc
            """)
    List<AssessmentInstance> listForFilters(
            @Param("schoolId") Integer schoolId,
            @Param("academicYearId") Integer academicYearId,
            @Param("classGroupId") Integer classGroupId,
            @Param("subjectId") Integer subjectId,
            @Param("schemeId") Integer schemeId,
            @Param("componentId") Integer componentId
    );

    /**
     * All non-draft, non-cancelled assessments for a class group — used by the student portal.
     */
    @Query("""
            select ai from AssessmentInstance ai
            where ai.school.id = :schoolId
              and ai.classGroup.id = :classGroupId
              and ai.status not in :excludedStatuses
            order by case when ai.assessmentDate is null then 1 else 0 end,
                     ai.assessmentDate asc,
                     ai.sequence asc
            """)
    List<AssessmentInstance> findForStudentPortal(
            @Param("schoolId") Integer schoolId,
            @Param("classGroupId") Integer classGroupId,
            @Param("excludedStatuses") List<AssessmentInstanceStatus> excludedStatuses
    );

    /**
     * Efficient count for the Marks Entry gate: counts rows in marks-entry-eligible statuses.
     * Use this instead of loading all rows.
     */
    @Query("""
            select count(ai) from AssessmentInstance ai
            where ai.school.id = :schoolId
              and ai.status in :statuses
            """)
    long countBySchoolIdAndStatusIn(
            @Param("schoolId") Integer schoolId,
            @Param("statuses") List<AssessmentInstanceStatus> statuses
    );
}
