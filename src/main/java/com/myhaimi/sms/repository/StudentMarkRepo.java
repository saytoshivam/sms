package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.StudentMark;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface StudentMarkRepo extends JpaRepository<StudentMark, Integer> {

    List<StudentMark> findBySchool_IdAndStudent_IdOrderByAssessedOnAsc(Integer schoolId, Integer studentId);

    List<StudentMark> findBySchool_IdAndStudent_IdIn(Integer schoolId, Collection<Integer> studentIds);

    Optional<StudentMark> findBySchool_IdAndStudent_IdAndAssessmentKey(
            Integer schoolId, Integer studentId, String assessmentKey);
}
