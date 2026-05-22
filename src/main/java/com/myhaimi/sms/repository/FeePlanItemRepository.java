package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.FeePlanItem;
import com.myhaimi.sms.entity.enums.ApplicableScopeType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FeePlanItemRepository extends JpaRepository<FeePlanItem, Integer> {

    List<FeePlanItem> findByFeePlan_IdOrderByIdAsc(Integer feePlanId);

    Optional<FeePlanItem> findByIdAndFeePlan_Id(Integer id, Integer feePlanId);

    boolean existsByFeePlan_Id(Integer feePlanId);

    /** Duplicate guard: same fee head + scope combination within a plan. */
    boolean existsByFeePlan_IdAndFeeHead_IdAndApplicableScopeTypeAndApplicableScopeId(
            Integer feePlanId, Integer feeHeadId, ApplicableScopeType scopeType, Integer scopeId);

    /** Same as above, excluding a specific item (for update validation). */
    boolean existsByFeePlan_IdAndFeeHead_IdAndApplicableScopeTypeAndApplicableScopeIdAndIdNot(
            Integer feePlanId, Integer feeHeadId, ApplicableScopeType scopeType, Integer scopeId, Integer excludeId);
}
