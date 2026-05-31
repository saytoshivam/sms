package com.myhaimi.sms.modules.exam.repository;

import com.myhaimi.sms.modules.exam.entity.GradingSchemeClassAssignment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GradingSchemeClassAssignmentRepository extends JpaRepository<GradingSchemeClassAssignment, Integer> {

    List<GradingSchemeClassAssignment> findByGradingScheme_Id(Integer gradingSchemeId);

    void deleteByGradingScheme_Id(Integer gradingSchemeId);
}
