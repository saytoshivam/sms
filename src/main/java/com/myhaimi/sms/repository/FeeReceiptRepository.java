package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.FeeReceipt;
import com.myhaimi.sms.entity.enums.PaymentMode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface FeeReceiptRepository extends JpaRepository<FeeReceipt, Long> {

    Optional<FeeReceipt> findByPayment_Id(Long paymentId);

    /**
     * Receipt register report.
     * Columns: [receiptId, receiptNo, paymentDate, studentId, firstName, lastName,
     *           admissionNo, classDisplayName, amount, paymentMode, referenceNo,
     *           paymentStatus, issuedAt, cancelledAt, paymentId]
     */
    @Query("""
            SELECT r.id, r.receiptNo, p.paymentDate,
                   p.student.id, p.student.firstName, p.student.lastName, p.student.admissionNo,
                   p.student.classGroup.displayName,
                   p.amount, p.paymentMode, p.referenceNo, p.status, r.issuedAt, r.cancelledAt, p.id
            FROM FeeReceipt r JOIN r.payment p
            WHERE p.school.id = :schoolId
              AND (:fromDate    IS NULL OR p.paymentDate >= :fromDate)
              AND (:toDate      IS NULL OR p.paymentDate <= :toDate)
              AND (:paymentMode IS NULL OR p.paymentMode  = :paymentMode)
              AND (:studentId   IS NULL OR p.student.id   = :studentId)
            ORDER BY p.paymentDate DESC, p.id DESC
            """)
    List<Object[]> receiptRegister(
            @Param("schoolId")    Integer schoolId,
            @Param("fromDate")    LocalDate fromDate,
            @Param("toDate")      LocalDate toDate,
            @Param("paymentMode") PaymentMode paymentMode,
            @Param("studentId")   Integer studentId);
}

