package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.FeeInstallment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;

public interface FeeInstallmentRepository extends JpaRepository<FeeInstallment, Integer> {

    List<FeeInstallment> findByFeePlanItem_IdOrderBySequenceAsc(Integer feePlanItemId);

    void deleteByFeePlanItem_Id(Integer feePlanItemId);

    @Query("SELECT COALESCE(SUM(fi.amount), 0) FROM FeeInstallment fi WHERE fi.feePlanItem.id = :itemId")
    BigDecimal sumAmountByFeePlanItemId(@Param("itemId") Integer itemId);
}
