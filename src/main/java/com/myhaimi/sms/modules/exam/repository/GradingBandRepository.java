package com.myhaimi.sms.modules.exam.repository;

import com.myhaimi.sms.modules.exam.entity.GradingBand;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface GradingBandRepository extends JpaRepository<GradingBand, Integer> {

    List<GradingBand> findByGradingScheme_IdOrderBySequenceAsc(Integer schemeId);

    @Modifying(flushAutomatically = true)
    @Query("delete from GradingBand b where b.gradingScheme.id = :schemeId")
    int deleteByGradingSchemeId(@Param("schemeId") Integer schemeId);
}
