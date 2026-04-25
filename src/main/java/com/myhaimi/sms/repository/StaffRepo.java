package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.Staff;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StaffRepo extends JpaRepository<Staff, Integer> {

    long countBySchool_Id(Integer schoolId);
    Page<Staff> findBySchool_IdAndIsDeletedFalse(Integer schoolId, Pageable pageable);

    List<Staff> findBySchool_IdAndIsDeletedFalseOrderByEmployeeNoAsc(Integer schoolId);

    Optional<Staff> findFirstBySchool_IdAndEmailIgnoreCaseAndIsDeletedFalse(Integer schoolId, String email);

    // Backwards compatible methods used by demo seeders / runners
    Optional<Staff> findFirstBySchool_IdAndEmailIgnoreCase(Integer schoolId, String email);
    List<Staff> findBySchool_IdOrderByEmployeeNoAsc(Integer schoolId);

    Optional<Staff> findByIdAndSchool_Id(Integer id, Integer schoolId);

    Optional<Staff> findByIdAndSchool_IdAndIsDeletedFalse(Integer id, Integer schoolId);

    long countBySchool_IdAndEmployeeNoIgnoreCaseAndIsDeletedFalse(Integer schoolId, String employeeNo);
}

