package com.myhaimi.sms.modules.exam.repository;

import com.myhaimi.sms.modules.exam.entity.GradingScheme;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GradingSchemeRepository extends JpaRepository<GradingScheme, Integer> {

    List<GradingScheme> findBySchool_IdOrderByCreatedAtAsc(Integer schoolId);

    Optional<GradingScheme> findByIdAndSchool_Id(Integer id, Integer schoolId);

    boolean existsBySchool_Id(Integer schoolId);

    long countBySchool_Id(Integer schoolId);
}
