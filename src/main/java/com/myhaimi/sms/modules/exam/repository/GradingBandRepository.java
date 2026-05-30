package com.myhaimi.sms.modules.exam.repository;

import com.myhaimi.sms.modules.exam.entity.GradingBand;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GradingBandRepository extends JpaRepository<GradingBand, Integer> {

    List<GradingBand> findByGradingScheme_IdOrderBySequenceAsc(Integer schemeId);
}
