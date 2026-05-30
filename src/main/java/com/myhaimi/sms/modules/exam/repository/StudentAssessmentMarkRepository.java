package com.myhaimi.sms.modules.exam.repository;

import com.myhaimi.sms.modules.exam.entity.StudentAssessmentMark;
import com.myhaimi.sms.modules.exam.entity.enums.MarkStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface StudentAssessmentMarkRepository extends JpaRepository<StudentAssessmentMark, Integer> {

    Optional<StudentAssessmentMark> findByAssessmentInstance_IdAndStudent_Id(Integer instanceId, Integer studentId);

    List<StudentAssessmentMark> findByAssessmentInstance_IdOrderByStudent_LastNameAscStudent_FirstNameAsc(Integer instanceId);

    List<StudentAssessmentMark> findByAssessmentInstance_IdAndStatus(Integer instanceId, MarkStatus status);

    boolean existsByAssessmentInstance_IdAndStudent_Id(Integer instanceId, Integer studentId);

    long countByAssessmentInstance_Id(Integer instanceId);

    @Query("""
            select m from StudentAssessmentMark m
            where m.assessmentInstance.id = :instanceId
            order by m.student.lastName asc, m.student.firstName asc
            """)
    List<StudentAssessmentMark> findAllByInstance(@Param("instanceId") Integer instanceId);

    @Query("""
            select m from StudentAssessmentMark m
            where m.assessmentInstance.id in :instanceIds
            order by m.assessmentInstance.id asc, m.student.lastName asc, m.student.firstName asc
            """)
    List<StudentAssessmentMark> findAllByInstanceIds(@Param("instanceIds") List<Integer> instanceIds);
}

