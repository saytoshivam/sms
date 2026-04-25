package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.Guardian;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GuardianRepo extends JpaRepository<Guardian, Integer> {
    Page<Guardian> findBySchool_Id(Integer schoolId, Pageable pageable);
    Page<Guardian> findBySchool_IdAndStudent_Id(Integer schoolId, Integer studentId, Pageable pageable);
}

