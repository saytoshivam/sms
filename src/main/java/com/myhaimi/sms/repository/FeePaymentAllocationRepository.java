package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.FeePaymentAllocation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface FeePaymentAllocationRepository extends JpaRepository<FeePaymentAllocation, Long> {

    List<FeePaymentAllocation> findByPayment_Id(Long paymentId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM FeePaymentAllocation a WHERE a.payment.id = :paymentId")
    void deleteByPayment_Id(@Param("paymentId") Long paymentId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM FeePaymentAllocation a WHERE a.payment.student.id IN :ids")
    void deleteByPayment_Student_IdIn(@Param("ids") Collection<Integer> ids);
}

