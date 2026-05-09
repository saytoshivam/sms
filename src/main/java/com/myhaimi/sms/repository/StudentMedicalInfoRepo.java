package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.StudentMedicalInfo;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface StudentMedicalInfoRepo extends JpaRepository<StudentMedicalInfo, Integer> {
    Optional<StudentMedicalInfo> findByStudent_Id(Integer studentId);
}
