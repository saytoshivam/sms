package com.myhaimi.sms.modules.exam.repository;

import com.myhaimi.sms.modules.exam.entity.AssessmentInstance;
import com.myhaimi.sms.modules.exam.entity.enums.AssessmentInstanceStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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
}



