package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.TimetableStatus;
import com.myhaimi.sms.entity.TimetableVersion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TimetableVersionRepo extends JpaRepository<TimetableVersion, Integer> {
    Optional<TimetableVersion> findTopBySchool_IdAndStatusOrderByVersionDesc(Integer schoolId, TimetableStatus status);
    Optional<TimetableVersion> findByIdAndSchool_Id(Integer id, Integer schoolId);
    long countBySchool_Id(Integer schoolId);
}

