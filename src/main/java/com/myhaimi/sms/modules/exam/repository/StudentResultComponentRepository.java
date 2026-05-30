package com.myhaimi.sms.modules.exam.repository;

import com.myhaimi.sms.modules.exam.entity.StudentResultComponent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StudentResultComponentRepository extends JpaRepository<StudentResultComponent, Integer> {

    List<StudentResultComponent> findByStudentResult_Id(Integer studentResultId);

    void deleteByStudentResult_Id(Integer studentResultId);
}

