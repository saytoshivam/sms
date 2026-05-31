package com.myhaimi.sms.modules.exam.repository;

import com.myhaimi.sms.modules.exam.entity.AssessmentSchemeAssignment;
import com.myhaimi.sms.modules.exam.entity.enums.ExamApplicableScopeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface AssessmentSchemeAssignmentRepository extends JpaRepository<AssessmentSchemeAssignment, Integer> {

    List<AssessmentSchemeAssignment> findByScheme_IdOrderByScopeTypeAscClassGroup_DisplayNameAscSubject_NameAsc(Integer schemeId);

    Optional<AssessmentSchemeAssignment> findByIdAndScheme_IdAndSchool_Id(Integer id, Integer schemeId, Integer schoolId);

    long countByScheme_IdAndActiveTrue(Integer schemeId);

    @Query("""
            select a from AssessmentSchemeAssignment a
            where a.school.id = :schoolId
              and a.academicYear.id = :academicYearId
              and a.active = true
              and a.scopeType = :scopeType
              and (:classGroupId is null or a.classGroup.id = :classGroupId)
              and (:subjectId is null or a.subject.id = :subjectId)
              and (:excludeSchemeId is null or a.scheme.id <> :excludeSchemeId)
              and a.scheme.status = com.myhaimi.sms.modules.exam.entity.enums.AssessmentSchemeStatus.PUBLISHED
            """)
    List<AssessmentSchemeAssignment> findConflicts(
            @Param("schoolId") Integer schoolId,
            @Param("academicYearId") Integer academicYearId,
            @Param("scopeType") ExamApplicableScopeType scopeType,
            @Param("classGroupId") Integer classGroupId,
            @Param("subjectId") Integer subjectId,
            @Param("excludeSchemeId") Integer excludeSchemeId
    );

    @Query("""
            select a from AssessmentSchemeAssignment a
            where a.school.id = :schoolId
              and a.academicYear.id = :academicYearId
              and a.active = true
              and (:schemeId is null or a.scheme.id = :schemeId)
            order by a.scopeType asc, a.id asc
            """)
    List<AssessmentSchemeAssignment> findActiveForGeneration(
            @Param("schoolId") Integer schoolId,
            @Param("academicYearId") Integer academicYearId,
            @Param("schemeId") Integer schemeId
    );
}


