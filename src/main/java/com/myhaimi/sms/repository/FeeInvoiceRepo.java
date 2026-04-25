package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.FeeInvoice;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface FeeInvoiceRepo extends JpaRepository<FeeInvoice, Integer> {
    Page<FeeInvoice> findBySchool_Id(Integer schoolId, Pageable pageable);

    Optional<FeeInvoice> findByIdAndSchool_Id(Integer id, Integer schoolId);

    List<FeeInvoice> findBySchool_IdAndStudent_IdOrderByDueDateAscIdAsc(Integer schoolId, Integer studentId);

    @Query(
            "SELECT COALESCE(SUM(i.amountDue), 0) FROM FeeInvoice i WHERE i.school.id = :schoolId AND i.status <>"
                    + " 'VOID'")
    BigDecimal sumAmountDueBySchoolId(@Param("schoolId") Integer schoolId);

    @Query("SELECT COUNT(i) FROM FeeInvoice i WHERE i.school.id = :schoolId AND i.status <> 'VOID'")
    long countInvoicesBySchoolId(@Param("schoolId") Integer schoolId);

    @Query(
            "SELECT COUNT(i) FROM FeeInvoice i WHERE i.school.id = :schoolId AND (i.status = 'DUE' OR i.status ="
                    + " 'PARTIAL')")
    long countOpenInvoicesBySchoolId(@Param("schoolId") Integer schoolId);
}

