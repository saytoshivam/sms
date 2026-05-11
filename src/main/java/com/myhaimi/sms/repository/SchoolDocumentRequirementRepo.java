package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.SchoolDocumentRequirement;
import com.myhaimi.sms.entity.enums.DocumentTargetType;
import com.myhaimi.sms.entity.enums.DocumentRequirementStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SchoolDocumentRequirementRepo extends JpaRepository<SchoolDocumentRequirement, Integer> {

    /** Active requirements for a school and target type, ordered by sortOrder. */
    List<SchoolDocumentRequirement> findBySchoolIdAndTargetTypeAndActiveTrueOrderBySortOrderAsc(
            Integer schoolId, DocumentTargetType targetType);

    /** All requirements (including inactive) for a school and target type — for the settings UI. */
    List<SchoolDocumentRequirement> findBySchoolIdAndTargetTypeOrderBySortOrderAsc(
            Integer schoolId, DocumentTargetType targetType);

    /** Check if a school has any configured requirements for a target type. */
    boolean existsBySchoolIdAndTargetTypeAndActiveTrue(
            Integer schoolId, DocumentTargetType targetType);

    Optional<SchoolDocumentRequirement> findBySchoolIdAndDocumentType_IdAndTargetType(
            Integer schoolId, Integer documentTypeId, DocumentTargetType targetType);

    /**
     * Active requirements that are REQUIRED or OPTIONAL (i.e., not explicitly NOT_REQUIRED).
     * Used when generating the student document checklist at onboarding.
     */
    @Query("""
           SELECT r FROM SchoolDocumentRequirement r
           WHERE r.schoolId = :schoolId
             AND r.targetType = :targetType
             AND r.active = true
             AND r.requirementStatus <> :excludeStatus
           ORDER BY r.sortOrder ASC
           """)
    List<SchoolDocumentRequirement> findActiveChecklistRequirements(
            Integer schoolId,
            DocumentTargetType targetType,
            DocumentRequirementStatus excludeStatus);
}

