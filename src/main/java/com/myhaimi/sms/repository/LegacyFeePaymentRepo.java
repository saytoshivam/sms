package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.LegacyFeePayment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface LegacyFeePaymentRepo extends JpaRepository<LegacyFeePayment, Integer> {

    List<LegacyFeePayment> findByInvoice_Id(Integer invoiceId);

    Optional<LegacyFeePayment> findByIdempotencyKey(String idempotencyKey);

    Optional<LegacyFeePayment> findByGatewayOrderId(String gatewayOrderId);

    @Query(
            "SELECT COALESCE(SUM(p.amount), 0) FROM LegacyFeePayment p JOIN p.invoice i WHERE i.school.id = :schoolId AND"
                    + " i.status <> 'VOID' AND (p.gatewayStatus IS NULL OR UPPER(p.gatewayStatus) = 'SUCCEEDED')")
    BigDecimal sumConfirmedPaymentsBySchoolId(@Param("schoolId") Integer schoolId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM LegacyFeePayment p WHERE p.invoice.id IN (SELECT i.id FROM FeeInvoice i WHERE i.student.id IN :ids)")
    void deleteByInvoice_Student_IdIn(@Param("ids") Collection<Integer> ids);
}

