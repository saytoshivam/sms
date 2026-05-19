package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.FeePlan;
import com.myhaimi.sms.entity.enums.FeePlanStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FeePlanRepository extends JpaRepository<FeePlan, Integer> {

    Page<FeePlan> findBySchool_IdOrderByCreatedAtDesc(Integer schoolId, Pageable pageable);

    List<FeePlan> findBySchool_IdAndStatus(Integer schoolId, FeePlanStatus status);

    Optional<FeePlan> findByIdAndSchool_Id(Integer id, Integer schoolId);
}
