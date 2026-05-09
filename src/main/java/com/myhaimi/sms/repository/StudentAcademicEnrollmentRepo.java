package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.StudentAcademicEnrollment;
import com.myhaimi.sms.entity.enums.StudentAcademicEnrollmentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

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
}
