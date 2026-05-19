package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.StudentFeeDemand;
import com.myhaimi.sms.entity.enums.StudentFeeDemandStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface StudentFeeDemandRepository extends JpaRepository<StudentFeeDemand, Long> {

    Page<StudentFeeDemand> findBySchool_Id(Integer schoolId, Pageable pageable);

    List<StudentFeeDemand> findBySchool_IdAndStudent_Id(Integer schoolId, Integer studentId);

    List<StudentFeeDemand> findBySchool_IdAndStatus(Integer schoolId, StudentFeeDemandStatus status);

    Optional<StudentFeeDemand> findByIdAndSchool_Id(Long id, Integer schoolId);

    boolean existsBySchool_IdAndDemandNo(Integer schoolId, String demandNo);

    /**
     * Duplicate guard: one demand per (school, student, plan-item, installment).
     * Mirrors the DB unique constraint {@code uq_sfd_student_item_installment}.
     */
    @Query("""
            SELECT COUNT(d) > 0 FROM StudentFeeDemand d
            WHERE d.school.id        = :schoolId
              AND d.student.id       = :studentId
              AND d.feePlanItem.id   = :feePlanItemId
              AND d.installment.id   = :installmentId
            """)
    boolean existsBySchool_IdAndStudentItemInstallment(
            @Param("schoolId")      Integer schoolId,
            @Param("studentId")     Integer studentId,
            @Param("feePlanItemId") Integer feePlanItemId,
            @Param("installmentId") Integer installmentId);


    /** Check if any demand exists for a given fee head in the school (used to guard deactivation). */
    boolean existsBySchool_IdAndFeeHead_Id(Integer schoolId, Integer feeHeadId);

    /**
     * Filtered demand list for admin view.
     * All parameters except schoolId are optional (pass null to skip filter).
     */
    @Query("""
            SELECT d FROM StudentFeeDemand d
            WHERE d.school.id = :schoolId
              AND (:studentId    IS NULL OR d.student.id              = :studentId)
              AND (:academicYearId IS NULL OR d.academicYear.id       = :academicYearId)
              AND (:feePlanId    IS NULL OR d.feePlan.id              = :feePlanId)
              AND (:status       IS NULL OR d.status                  = :status)
              AND (:dueFrom      IS NULL OR d.dueDate                >= :dueFrom)
              AND (:dueTo        IS NULL OR d.dueDate                <= :dueTo)
            ORDER BY d.dueDate ASC, d.id ASC
            """)
    List<StudentFeeDemand> findFiltered(
            @Param("schoolId")       Integer schoolId,
            @Param("studentId")      Integer studentId,
            @Param("academicYearId") Integer academicYearId,
            @Param("feePlanId")      Integer feePlanId,
            @Param("status")         StudentFeeDemandStatus status,
            @Param("dueFrom")        LocalDate dueFrom,
            @Param("dueTo")          LocalDate dueTo);

    // ─── Dashboard aggregates ─────────────────────────────────────────────────

    @Query("SELECT COALESCE(SUM(d.payableAmount), 0) FROM StudentFeeDemand d WHERE d.school.id = :schoolId AND (:academicYearId IS NULL OR d.academicYear.id = :academicYearId)")
    BigDecimal sumPayableAmount(@Param("schoolId") Integer schoolId, @Param("academicYearId") Integer academicYearId);

    @Query("SELECT COALESCE(SUM(d.paidAmount), 0) FROM StudentFeeDemand d WHERE d.school.id = :schoolId AND (:academicYearId IS NULL OR d.academicYear.id = :academicYearId)")
    BigDecimal sumPaidAmount(@Param("schoolId") Integer schoolId, @Param("academicYearId") Integer academicYearId);

    @Query("SELECT COALESCE(SUM(d.balanceAmount), 0) FROM StudentFeeDemand d WHERE d.school.id = :schoolId AND d.status IN :statuses AND (:academicYearId IS NULL OR d.academicYear.id = :academicYearId)")
    BigDecimal sumOutstanding(@Param("schoolId") Integer schoolId, @Param("statuses") Collection<StudentFeeDemandStatus> statuses, @Param("academicYearId") Integer academicYearId);

    @Query("SELECT COALESCE(SUM(d.balanceAmount), 0) FROM StudentFeeDemand d WHERE d.school.id = :schoolId AND d.status IN :statuses AND d.dueDate < :today AND (:academicYearId IS NULL OR d.academicYear.id = :academicYearId)")
    BigDecimal sumOverdue(@Param("schoolId") Integer schoolId, @Param("statuses") Collection<StudentFeeDemandStatus> statuses, @Param("academicYearId") Integer academicYearId, @Param("today") LocalDate today);

    @Query("SELECT COUNT(DISTINCT d.student.id) FROM StudentFeeDemand d WHERE d.school.id = :schoolId AND d.balanceAmount > 0 AND (:academicYearId IS NULL OR d.academicYear.id = :academicYearId)")
    long countStudentsWithDues(@Param("schoolId") Integer schoolId, @Param("academicYearId") Integer academicYearId);

    @Query("SELECT COUNT(d) FROM StudentFeeDemand d WHERE d.school.id = :schoolId")
    long countBySchoolId(@Param("schoolId") Integer schoolId);

    @Query("SELECT COUNT(d) FROM StudentFeeDemand d WHERE d.school.id = :schoolId AND d.status IN :statuses")
    long countOpenBySchoolId(@Param("schoolId") Integer schoolId, @Param("statuses") Collection<StudentFeeDemandStatus> statuses);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM StudentFeeDemand d WHERE d.student.id IN :ids")
    void deleteByStudent_IdIn(@Param("ids") Collection<Integer> ids);

    // ─── Report queries ───────────────────────────────────────────────────────

    /**
     * Class-wise outstanding report.
     * Columns: [classGroupId, displayName, section, studentCount, demandCount, sumPayable, sumPaid, sumBalance]
     */
    @Query("""
            SELECT cg.id, cg.displayName, cg.section,
                   COUNT(DISTINCT s.id), COUNT(d.id),
                   SUM(d.payableAmount), SUM(d.paidAmount), SUM(d.balanceAmount)
            FROM StudentFeeDemand d
            JOIN d.student s
            JOIN s.classGroup cg
            WHERE d.school.id = :schoolId
              AND d.status IN :statuses
              AND (:academicYearId IS NULL OR d.academicYear.id = :academicYearId)
              AND (:classGroupId   IS NULL OR cg.id              = :classGroupId)
              AND (:section        IS NULL OR cg.section         = :section)
            GROUP BY cg.id, cg.displayName, cg.section
            ORDER BY SUM(d.balanceAmount) DESC
            """)
    List<Object[]> classOutstandingReport(
            @Param("schoolId")      Integer schoolId,
            @Param("statuses")      Collection<StudentFeeDemandStatus> statuses,
            @Param("academicYearId") Integer academicYearId,
            @Param("classGroupId")  Integer classGroupId,
            @Param("section")       String section);

    /**
     * Student due report.
     * Columns: [studentId, firstName, lastName, admissionNo, classDisplayName, sumPayable, sumPaid, sumBalance]
     */
    @Query("""
            SELECT s.id, s.firstName, s.lastName, s.admissionNo,
                   cg.displayName,
                   SUM(d.payableAmount), SUM(d.paidAmount), SUM(d.balanceAmount)
            FROM StudentFeeDemand d
            JOIN d.student s
            LEFT JOIN s.classGroup cg
            WHERE d.school.id = :schoolId
              AND d.balanceAmount > 0
              AND (:academicYearId IS NULL OR d.academicYear.id = :academicYearId)
              AND (:classGroupId   IS NULL OR cg.id              = :classGroupId)
              AND (:section        IS NULL OR cg.section         = :section)
            GROUP BY s.id, s.firstName, s.lastName, s.admissionNo, cg.displayName
            ORDER BY SUM(d.balanceAmount) DESC
            """)
    List<Object[]> studentDueReport(
            @Param("schoolId")      Integer schoolId,
            @Param("academicYearId") Integer academicYearId,
            @Param("classGroupId")  Integer classGroupId,
            @Param("section")       String section);
}

