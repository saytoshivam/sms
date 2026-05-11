package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.DocumentType;
import com.myhaimi.sms.entity.enums.DocumentTargetType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DocumentTypeRepo extends JpaRepository<DocumentType, Integer> {

    /** All active document types for a given target (used to populate the settings UI). */
    List<DocumentType> findByTargetTypeAndActiveTrueOrderBySortOrderAsc(DocumentTargetType targetType);

    /** All active document types regardless of target (used for master list). */
    List<DocumentType> findByActiveTrueOrderByTargetTypeAscSortOrderAsc();

    Optional<DocumentType> findByCodeAndTargetType(String code, DocumentTargetType targetType);
}

