package com.myhaimi.sms.modules.exam.repository;

import com.myhaimi.sms.modules.exam.entity.StudentResult;
import com.myhaimi.sms.modules.exam.entity.enums.ResultStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface StudentResultRepository extends JpaRepository<StudentResult, Integer> {

    Optional<StudentResult> findByStudent_IdAndSubject_IdAndScheme_Id(
            Integer studentId, Integer subjectId, Integer schemeId);

    List<StudentResult> findBySchool_IdAndClassGroup_IdAndScheme_IdAndSubject_Id(
            Integer schoolId, Integer classGroupId, Integer schemeId, Integer subjectId);

    List<StudentResult> findByStudent_Id(Integer studentId);

    List<StudentResult> findByStudent_IdAndSchool_Id(Integer studentId, Integer schoolId);

    List<StudentResult> findByStudent_IdAndScheme_IdOrderBySubjectNameAsc(
            Integer studentId, Integer schemeId);

    boolean existsByStudent_IdAndSubject_IdAndScheme_Id(
            Integer studentId, Integer subjectId, Integer schemeId);

    @Query("""
            select r from StudentResult r
            where r.school.id = :schoolId
              and (:classGroupId is null or r.classGroup.id = :classGroupId)
              and (:schemeId is null or r.scheme.id = :schemeId)
              and (:subjectId is null or r.subject.id = :subjectId)
              and (:status is null or r.status = :status)
            order by r.student.lastName asc, r.student.firstName asc
            """)
    List<StudentResult> listForFilters(
            @Param("schoolId") Integer schoolId,
            @Param("classGroupId") Integer classGroupId,
            @Param("schemeId") Integer schemeId,
            @Param("subjectId") Integer subjectId,
            @Param("status") ResultStatus status
    );
}

