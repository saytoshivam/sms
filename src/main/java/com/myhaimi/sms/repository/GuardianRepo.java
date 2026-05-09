package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.Guardian;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GuardianRepo extends JpaRepository<Guardian, Integer> {

    Page<Guardian> findBySchool_Id(Integer schoolId, Pageable pageable);

    @Query(
            """
            SELECT g FROM Guardian g
             WHERE g.school.id = :schoolId AND (
               :studentId IS NULL
               OR EXISTS (SELECT 1 FROM StudentGuardian sg WHERE sg.guardian.id = g.id AND sg.student.id = :studentId))
            """)
    Page<Guardian> findBySchoolAndOptionalStudentLink(
            @Param("schoolId") Integer schoolId, @Param("studentId") Integer studentId, Pageable pageable);
}

