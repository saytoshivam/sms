package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.StudentAcademicEnrollment;
import com.myhaimi.sms.entity.enums.StudentAcademicEnrollmentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;

public interface StudentAcademicEnrollmentRepo extends JpaRepository<StudentAcademicEnrollment, Integer> {

    List<StudentAcademicEnrollment> findByStudent_IdOrderByAcademicYearStartsOnDesc(Integer studentId);

    @Query(
            """
            SELECT e FROM StudentAcademicEnrollment e
            JOIN FETCH e.academicYear ay
            JOIN FETCH e.classGroup cg
            WHERE e.student.id IN :studentIds AND ay.id = :academicYearId
            """)
    List<StudentAcademicEnrollment> findEnrollmentsForStudentsInYear(
            @Param("studentIds") Collection<Integer> studentIds, @Param("academicYearId") Integer academicYearId);

    Optional<StudentAcademicEnrollment> findFirstByStudent_IdAndAcademicYear_Id(Integer studentId, Integer academicYearId);

    Optional<StudentAcademicEnrollment> findFirstByStudent_IdAndStatus(
            Integer studentId, StudentAcademicEnrollmentStatus status);

    long countByStudent_IdAndAcademicYear_IdAndStatus(
            Integer studentId, Integer academicYearId, StudentAcademicEnrollmentStatus status);

    boolean existsByAcademicYear_IdAndClassGroup_IdAndRollNo(Integer academicYearId, Integer classGroupId, String rollNo);

    @Query("""
            SELECT e.rollNo FROM StudentAcademicEnrollment e
            WHERE e.classGroup.id = :classGroupId
              AND e.academicYear.id = :academicYearId
              AND e.rollNo IS NOT NULL
            """)
    Set<String> findRollNosForClassAndYear(
            @Param("classGroupId") Integer classGroupId,
            @Param("academicYearId") Integer academicYearId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM StudentAcademicEnrollment e WHERE e.student.id IN :ids")
    void deleteByStudent_IdIn(@Param("ids") Collection<Integer> ids);

    // ── Demand-generation scope queries ───────────────────────────────────────

    /** All ACTIVE enrollments for a school in a given academic year (SCHOOL scope). */
    @Query("""
            SELECT e FROM StudentAcademicEnrollment e
            JOIN FETCH e.student s
            WHERE s.school.id = :schoolId
              AND e.academicYear.id = :academicYearId
              AND e.status = com.myhaimi.sms.entity.enums.StudentAcademicEnrollmentStatus.ACTIVE
            """)
    List<StudentAcademicEnrollment> findActiveEnrollmentsBySchoolAndYear(
            @Param("schoolId") Integer schoolId,
            @Param("academicYearId") Integer academicYearId);

    /**
     * Same as above but also eagerly fetches classGroup — used by demand generation
     * to avoid N+1 when resolving per-student override priority.
     */
    @Query("""
            SELECT e FROM StudentAcademicEnrollment e
            JOIN FETCH e.student s
            JOIN FETCH e.classGroup cg
            WHERE s.school.id = :schoolId
              AND e.academicYear.id = :academicYearId
              AND e.status = com.myhaimi.sms.entity.enums.StudentAcademicEnrollmentStatus.ACTIVE
            """)
    List<StudentAcademicEnrollment> findActiveEnrollmentsWithClassGroupBySchoolAndYear(
            @Param("schoolId") Integer schoolId,
            @Param("academicYearId") Integer academicYearId);

    /** ACTIVE enrollments for a specific classGroup (SECTION scope). */
    @Query("""
            SELECT e FROM StudentAcademicEnrollment e
            JOIN FETCH e.student s
            WHERE s.school.id = :schoolId
              AND e.academicYear.id = :academicYearId
              AND e.classGroup.id = :classGroupId
              AND e.status = com.myhaimi.sms.entity.enums.StudentAcademicEnrollmentStatus.ACTIVE
            """)
    List<StudentAcademicEnrollment> findActiveEnrollmentsBySchoolYearAndClassGroup(
            @Param("schoolId") Integer schoolId,
            @Param("academicYearId") Integer academicYearId,
            @Param("classGroupId") Integer classGroupId);

    /** ACTIVE enrollments for all classGroups sharing the same gradeLevel (CLASS scope). */
    @Query("""
            SELECT e FROM StudentAcademicEnrollment e
            JOIN FETCH e.student s
            JOIN e.classGroup cg
            WHERE s.school.id = :schoolId
              AND e.academicYear.id = :academicYearId
              AND cg.gradeLevel = :gradeLevel
              AND e.status = com.myhaimi.sms.entity.enums.StudentAcademicEnrollmentStatus.ACTIVE
            """)
    List<StudentAcademicEnrollment> findActiveEnrollmentsBySchoolYearAndGradeLevel(
            @Param("schoolId") Integer schoolId,
            @Param("academicYearId") Integer academicYearId,
            @Param("gradeLevel") Integer gradeLevel);

    /** Single ACTIVE enrollment for a specific student in a given year (STUDENT scope). */
    @Query("""
            SELECT e FROM StudentAcademicEnrollment e
            JOIN FETCH e.student s
            WHERE s.school.id = :schoolId
              AND s.id = :studentId
              AND e.academicYear.id = :academicYearId
              AND e.status = com.myhaimi.sms.entity.enums.StudentAcademicEnrollmentStatus.ACTIVE
            """)
    Optional<StudentAcademicEnrollment> findActiveEnrollmentForStudent(
            @Param("schoolId") Integer schoolId,
            @Param("studentId") Integer studentId,
            @Param("academicYearId") Integer academicYearId);
}
