package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.FeeHead;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FeeHeadRepository extends JpaRepository<FeeHead, Integer> {

    boolean existsBySchool_IdAndCode(Integer schoolId, String code);

    boolean existsBySchool_IdAndCodeAndIdNot(Integer schoolId, String code, Integer excludeId);

    Page<FeeHead> findBySchool_IdOrderByNameAsc(Integer schoolId, Pageable pageable);

    List<FeeHead> findBySchool_IdAndActiveTrue(Integer schoolId);

    Optional<FeeHead> findByIdAndSchool_Id(Integer id, Integer schoolId);
}
