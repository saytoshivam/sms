package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.StudentGuardian;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface StudentGuardianRepo extends JpaRepository<StudentGuardian, Integer> {
    List<StudentGuardian> findByStudent_IdOrderByPrimaryGuardianDescIdAsc(Integer studentId);

    long countByStudent_Id(Integer studentId);

    @Query(
            """
            SELECT sg FROM StudentGuardian sg
            JOIN FETCH sg.guardian g
            WHERE sg.primaryGuardian = true AND sg.student.id IN :ids
            """)
    List<StudentGuardian> findPrimaryLinksWithGuardianForStudentIds(@Param("ids") Collection<Integer> ids);
}
