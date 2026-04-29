package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.Subject;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SubjectRepo extends JpaRepository<Subject, Integer> {

    List<Subject> findBySchool_IdAndIsDeletedFalseOrderByCodeAsc(Integer schoolId);
    Page<Subject> findBySchool_IdAndIsDeletedFalse(Integer schoolId, Pageable pageable);

    Optional<Subject> findBySchool_IdAndCode(Integer schoolId, String code);

    /** Includes soft-deleted rows (needed for safe normalization by subject code). */
    List<Subject> findBySchool_IdOrderByCodeAsc(Integer schoolId);

    @Query("select s from Subject s where s.isDeleted = true")
    List<Subject> findAllSoftDeleted();
}

