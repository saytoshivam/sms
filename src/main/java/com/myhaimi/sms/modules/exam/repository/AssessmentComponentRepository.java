package com.myhaimi.sms.modules.exam.repository;

import com.myhaimi.sms.modules.exam.entity.AssessmentComponent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AssessmentComponentRepository extends JpaRepository<AssessmentComponent, Integer> {

    List<AssessmentComponent> findByScheme_IdOrderBySequenceAsc(Integer schemeId);

    Optional<AssessmentComponent> findByIdAndScheme_Id(Integer id, Integer schemeId);

    boolean existsByScheme_IdAndNameIgnoreCase(Integer schemeId, String name);

    boolean existsByScheme_IdAndSequence(Integer schemeId, Integer sequence);
}
