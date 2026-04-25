package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.School;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SchoolRepo extends JpaRepository<School, Integer> {
    Optional<School> findByCode(String code);
    boolean existsByCode(String code);

    long countByArchivedFalse();

    boolean existsByCodeAndIdNot(String code, Integer id);
}

