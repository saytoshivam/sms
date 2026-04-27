package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.Student;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface StudentRepo extends JpaRepository<Student, Integer> {
    Page<Student> findBySchool_Id(Integer schoolId, Pageable pageable);

    List<Student> findBySchool_IdOrderByIdAsc(Integer schoolId);

    List<Student> findBySchool_IdOrderByLastNameAscFirstNameAsc(Integer schoolId);

    List<Student> findBySchool_IdAndClassGroup_IdOrderByLastNameAscFirstNameAsc(
            Integer schoolId, Integer classGroupId);

    Optional<Student> findByIdAndSchool_Id(Integer id, Integer schoolId);

    Optional<Student> findBySchool_IdAndAdmissionNo(Integer schoolId, String admissionNo);

    long countBySchool_Id(Integer schoolId);

    @Query("SELECT s.school.id, COUNT(s) FROM Student s GROUP BY s.school.id")
    List<Object[]> countStudentsGroupedBySchool();

    @Query("SELECT s.classGroup.id, COUNT(s) FROM Student s WHERE s.school.id = :schoolId GROUP BY s.classGroup.id")
    List<Object[]> countStudentsGroupedByClassGroup(@Param("schoolId") Integer schoolId);

    @Query(
            "SELECT COUNT(s) FROM Student s WHERE s.school.id = :schoolId AND s.createdAt >= :from AND s.createdAt < :to")
    long countCreatedBetween(
            @Param("schoolId") Integer schoolId, @Param("from") Instant from, @Param("to") Instant to);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from Student s where s.school.id = :schoolId")
    void deleteBySchool_Id(@Param("schoolId") Integer schoolId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from Student s where s.school.id = :schoolId and s.classGroup.id = :classGroupId")
    int deleteBySchool_IdAndClassGroup_Id(@Param("schoolId") Integer schoolId, @Param("classGroupId") Integer classGroupId);
}

