package com.myhaimi.sms.modules.exam.repository;

import com.myhaimi.sms.modules.exam.entity.AssessmentScheme;
import com.myhaimi.sms.modules.exam.entity.enums.AssessmentSchemeStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AssessmentSchemeRepository extends JpaRepository<AssessmentScheme, Integer> {

    List<AssessmentScheme> findBySchool_IdOrderByCreatedAtDesc(Integer schoolId);

    List<AssessmentScheme> findBySchool_IdAndStatusOrderByCreatedAtDesc(Integer schoolId, AssessmentSchemeStatus status);

    Optional<AssessmentScheme> findByIdAndSchool_Id(Integer id, Integer schoolId);
}
