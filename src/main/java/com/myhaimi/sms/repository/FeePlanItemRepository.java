package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.FeePlanItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FeePlanItemRepository extends JpaRepository<FeePlanItem, Integer> {

    List<FeePlanItem> findByFeePlan_IdOrderByIdAsc(Integer feePlanId);

    Optional<FeePlanItem> findByIdAndFeePlan_Id(Integer id, Integer feePlanId);

    boolean existsByFeePlan_Id(Integer feePlanId);
}
