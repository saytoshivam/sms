package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.StudentMedicalInfo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.Optional;

public interface StudentMedicalInfoRepo extends JpaRepository<StudentMedicalInfo, Integer> {
    Optional<StudentMedicalInfo> findByStudent_Id(Integer studentId);

    @Modifying
    @Query("DELETE FROM StudentMedicalInfo m WHERE m.student.id IN :ids")
    void deleteByStudent_IdIn(@Param("ids") Collection<Integer> ids);
}
