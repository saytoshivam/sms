package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.FeePayment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface FeePaymentRepo extends JpaRepository<FeePayment, Integer> {
    List<FeePayment> findByInvoice_Id(Integer invoiceId);

    Optional<FeePayment> findByIdempotencyKey(String idempotencyKey);

    Optional<FeePayment> findByGatewayOrderId(String gatewayOrderId);

    @Query(
            "SELECT COALESCE(SUM(p.amount), 0) FROM FeePayment p JOIN p.invoice i WHERE i.school.id = :schoolId AND"
                    + " i.status <> 'VOID' AND (p.gatewayStatus IS NULL OR UPPER(p.gatewayStatus) = 'SUCCEEDED')")
    BigDecimal sumConfirmedPaymentsBySchoolId(@Param("schoolId") Integer schoolId);
}

