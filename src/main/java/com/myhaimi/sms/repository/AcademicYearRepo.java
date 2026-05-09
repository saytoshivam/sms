package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.AcademicYear;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AcademicYearRepo extends JpaRepository<AcademicYear, Integer> {
    Optional<AcademicYear> findFirstBySchool_Id(Integer schoolId, Sort sort);

    Optional<AcademicYear> findByIdAndSchool_Id(Integer id, Integer schoolId);

    List<AcademicYear> findBySchool_Id(Integer schoolId, Sort sort);
}
