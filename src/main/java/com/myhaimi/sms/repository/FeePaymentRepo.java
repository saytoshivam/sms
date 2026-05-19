package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.FeePayment;
import com.myhaimi.sms.entity.enums.PaymentMode;
import com.myhaimi.sms.entity.enums.PaymentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface FeePaymentRepo extends JpaRepository<FeePayment, Long> {

    List<FeePayment> findBySchool_IdAndStudent_IdOrderByPaymentDateDesc(Integer schoolId, Integer studentId);

    Optional<FeePayment> findByIdAndSchool_Id(Long id, Integer schoolId);

    /** Filtered list for admin view. All optional params — pass null to skip. */
    @Query("""
            SELECT p FROM FeePayment p
            WHERE p.school.id = :schoolId
              AND (:studentId   IS NULL OR p.student.id    = :studentId)
              AND (:paymentMode IS NULL OR p.paymentMode   = :paymentMode)
              AND (:fromDate    IS NULL OR p.paymentDate  >= :fromDate)
              AND (:toDate      IS NULL OR p.paymentDate  <= :toDate)
              AND (:status      IS NULL OR p.status        = :status)
            ORDER BY p.paymentDate DESC, p.id DESC
            """)
    List<FeePayment> findFiltered(
            @Param("schoolId")    Integer schoolId,
            @Param("studentId")   Integer studentId,
            @Param("paymentMode") PaymentMode paymentMode,
            @Param("fromDate")    LocalDate fromDate,
            @Param("toDate")      LocalDate toDate,
            @Param("status")      PaymentStatus status);


    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM FeePayment p WHERE p.student.id IN :ids")
    void deleteByStudent_IdIn(@Param("ids") Collection<Integer> ids);

    // ─── Report queries ───────────────────────────────────────────────────────

    /**
     * Daily collection report grouped by date + payment mode.
     * Columns: [paymentDate, paymentMode, sumAmount, count]
     */
    @Query("""
            SELECT p.paymentDate, p.paymentMode, SUM(p.amount), COUNT(p.id)
            FROM FeePayment p
            WHERE p.school.id = :schoolId
              AND p.status = com.myhaimi.sms.entity.enums.PaymentStatus.SUCCESS
              AND (:fromDate    IS NULL OR p.paymentDate >= :fromDate)
              AND (:toDate      IS NULL OR p.paymentDate <= :toDate)
              AND (:paymentMode IS NULL OR p.paymentMode = :paymentMode)
            GROUP BY p.paymentDate, p.paymentMode
            ORDER BY p.paymentDate DESC, p.paymentMode
            """)
    List<Object[]> dailyCollectionReport(
            @Param("schoolId")    Integer schoolId,
            @Param("fromDate")    LocalDate fromDate,
            @Param("toDate")      LocalDate toDate,
            @Param("paymentMode") PaymentMode paymentMode);

    /**
     * Payment mode summary.
     * Columns: [paymentMode, sumAmount, count]
     */
    @Query("""
            SELECT p.paymentMode, SUM(p.amount), COUNT(p.id)
            FROM FeePayment p
            WHERE p.school.id = :schoolId
              AND p.status = com.myhaimi.sms.entity.enums.PaymentStatus.SUCCESS
              AND (:fromDate IS NULL OR p.paymentDate >= :fromDate)
              AND (:toDate   IS NULL OR p.paymentDate <= :toDate)
            GROUP BY p.paymentMode
            ORDER BY SUM(p.amount) DESC
            """)
    List<Object[]> paymentModeReport(
            @Param("schoolId") Integer schoolId,
            @Param("fromDate") LocalDate fromDate,
            @Param("toDate")   LocalDate toDate);
}
