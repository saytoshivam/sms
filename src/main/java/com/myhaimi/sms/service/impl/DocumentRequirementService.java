package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.docreq.*;
import com.myhaimi.sms.entity.*;
import com.myhaimi.sms.entity.enums.DocumentRequirementStatus;
import com.myhaimi.sms.entity.enums.DocumentTargetType;
import com.myhaimi.sms.entity.enums.DocumentCollectionStatus;
import com.myhaimi.sms.entity.enums.DocumentUploadStatus;
import com.myhaimi.sms.entity.enums.DocumentVerificationStatus;
import com.myhaimi.sms.entity.enums.StudentLifecycleStatus;
import com.myhaimi.sms.repository.*;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DocumentRequirementService {

    private final DocumentTypeRepo documentTypeRepo;
    private final SchoolDocumentRequirementRepo requirementRepo;
    private final StudentRepo studentRepo;
    private final StudentDocumentRepo documentRepo;
    private final StudentAccessGuard accessGuard;

    // ── Document types ────────────────────────────────────────────────────────

    /** All active document types for a target (used to populate the settings UI). */
    public List<DocumentTypeDTO> listDocumentTypes(DocumentTargetType targetType) {
        List<DocumentType> types = (targetType != null)
                ? documentTypeRepo.findByTargetTypeAndActiveTrueOrderBySortOrderAsc(targetType)
                : documentTypeRepo.findByActiveTrueOrderByTargetTypeAscSortOrderAsc();
        return types.stream().map(this::toDTO).toList();
    }

    // ── School requirements ───────────────────────────────────────────────────

    /**
     * Returns the school's current requirements for a target type.
     * Each entry in the result corresponds to one document type configured for this school.
     */
    public List<SchoolDocumentRequirementDTO> getSchoolRequirements(DocumentTargetType targetType) {
        Integer schoolId = requireSchoolId();
        List<SchoolDocumentRequirement> reqs = requirementRepo
                .findBySchoolIdAndTargetTypeOrderBySortOrderAsc(schoolId, targetType);
        return reqs.stream().map(this::toDTO).toList();
    }

    /**
     * Replaces all school requirements for a target type.
     * - Creates new requirement rows for newly added types.
     * - Updates requirementStatus / sortOrder for existing rows.
     * - Marks removed rows as inactive (does NOT delete to preserve audit trail).
     */
    @Transactional
    public List<SchoolDocumentRequirementDTO> saveRequirements(SaveDocumentRequirementsPayload payload) {
        Integer schoolId = requireSchoolId();
        // Only school leadership may configure document requirements
        StudentCallerContext ctx = accessGuard.resolve(schoolId);
        if (!ctx.canEdit()) {
            throw new AccessDeniedException(
                    "You do not have permission to configure document requirements.");
        }

        DocumentTargetType targetType = payload.getTargetType();
        List<SaveDocumentRequirementsPayload.RequirementItem> incoming =
                payload.getRequirements() == null ? List.of() : payload.getRequirements();

        // Load existing requirements indexed by documentTypeId
        Map<Integer, SchoolDocumentRequirement> existing = requirementRepo
                .findBySchoolIdAndTargetTypeOrderBySortOrderAsc(schoolId, targetType)
                .stream()
                .collect(Collectors.toMap(r -> r.getDocumentType().getId(), r -> r));

        Set<Integer> processedTypeIds = new java.util.HashSet<>();

        for (SaveDocumentRequirementsPayload.RequirementItem item : incoming) {
            DocumentType docType;

            if (item.getDocumentTypeId() != null) {
                docType = documentTypeRepo.findById(item.getDocumentTypeId())
                        .orElseThrow(() -> new IllegalArgumentException(
                                "Document type not found: " + item.getDocumentTypeId()));
            } else {
                // Custom document type — create if not already present
                String code = (item.getCode() != null ? item.getCode() : "CUSTOM").toUpperCase()
                        .replaceAll("[^A-Z0-9_]", "_");
                docType = documentTypeRepo.findByCodeAndTargetType(code, targetType)
                        .orElseGet(() -> {
                            DocumentType dt = new DocumentType();
                            dt.setCode(code);
                            dt.setName(item.getName() != null ? item.getName().trim() : code);
                            dt.setTargetType(targetType);
                            dt.setSystemDefined(false);
                            dt.setActive(true);
                            dt.setSortOrder(item.getSortOrder());
                            return documentTypeRepo.save(dt);
                        });
            }

            SchoolDocumentRequirement req = existing.get(docType.getId());
            if (req == null) {
                req = new SchoolDocumentRequirement();
                req.setSchoolId(schoolId);
                req.setDocumentType(docType);
                req.setTargetType(targetType);
            }
            req.setRequirementStatus(
                    item.getRequirementStatus() != null
                            ? item.getRequirementStatus()
                            : DocumentRequirementStatus.REQUIRED);
            req.setActive(true);
            req.setSortOrder(item.getSortOrder());
            requirementRepo.save(req);
            processedTypeIds.add(docType.getId());
        }

        // Mark removed requirements as inactive
        for (Map.Entry<Integer, SchoolDocumentRequirement> entry : existing.entrySet()) {
            if (!processedTypeIds.contains(entry.getKey())) {
                SchoolDocumentRequirement removed = entry.getValue();
                removed.setActive(false);
                requirementRepo.save(removed);
            }
        }

        return getSchoolRequirements(targetType);
    }

    /**
     * Applies the current school document requirements to all existing active students.
     * Creates missing {@code student_document} checklist rows — never deletes existing ones.
     */
    @Transactional
    public ApplyRequirementsResultDTO applyRequirementsToExistingStudents() {
        Integer schoolId = requireSchoolId();
        StudentCallerContext ctx = accessGuard.resolve(schoolId);
        if (!ctx.canEdit()) {
            throw new AccessDeniedException(
                    "You do not have permission to apply document requirements.");
        }

        List<SchoolDocumentRequirement> reqs = requirementRepo
                .findActiveChecklistRequirements(schoolId, DocumentTargetType.STUDENT,
                        DocumentRequirementStatus.NOT_REQUIRED);

        if (reqs.isEmpty()) {
            return ApplyRequirementsResultDTO.builder()
                    .studentsProcessed(0)
                    .documentRowsCreated(0)
                    .message("No active requirements configured for students.")
                    .build();
        }

        List<Student> activeStudents = studentRepo.findBySchool_IdAndStatus(
                schoolId, StudentLifecycleStatus.ACTIVE);

        int totalRows = 0;

        for (Student student : activeStudents) {
            Set<String> existingCodes = documentRepo
                    .findByStudent_IdOrderByCreatedAtDesc(student.getId())
                    .stream()
                    .map(StudentDocument::getDocumentType)
                    .collect(Collectors.toSet());

            for (SchoolDocumentRequirement req : reqs) {
                DocumentType dt = req.getDocumentType();
                if (!existingCodes.contains(dt.getCode())) {
                    StudentDocument doc = new StudentDocument();
                    doc.setStudent(student);
                    doc.setDocumentType(dt.getCode());
                    doc.setDocumentTypeId(dt.getId());
                    doc.setCollectionStatus(DocumentCollectionStatus.PENDING_COLLECTION);
                    doc.setUploadStatus(DocumentUploadStatus.NOT_UPLOADED);
                    doc.setVerificationStatus(DocumentVerificationStatus.NOT_VERIFIED);
                    documentRepo.save(doc);
                    totalRows++;
                }
            }
        }

        return ApplyRequirementsResultDTO.builder()
                .studentsProcessed(activeStudents.size())
                .documentRowsCreated(totalRows)
                .message(String.format(
                        "Processed %d active students; created %d new document checklist rows.",
                        activeStudents.size(), totalRows))
                .build();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Integer requireSchoolId() {
        Integer id = TenantContext.getSchoolId();
        if (id == null) throw new IllegalStateException("Missing school context");
        return id;
    }

    private DocumentTypeDTO toDTO(DocumentType dt) {
        DocumentTypeDTO d = new DocumentTypeDTO();
        d.setId(dt.getId());
        d.setCode(dt.getCode());
        d.setName(dt.getName());
        d.setDescription(dt.getDescription());
        d.setTargetType(dt.getTargetType());
        d.setSystemDefined(dt.isSystemDefined());
        d.setActive(dt.isActive());
        d.setSortOrder(dt.getSortOrder());
        return d;
    }

    private SchoolDocumentRequirementDTO toDTO(SchoolDocumentRequirement r) {
        SchoolDocumentRequirementDTO d = new SchoolDocumentRequirementDTO();
        d.setId(r.getId());
        DocumentType dt = r.getDocumentType();
        d.setDocumentTypeId(dt.getId());
        d.setDocumentTypeCode(dt.getCode());
        d.setDocumentTypeName(dt.getName());
        d.setDocumentTypeDescription(dt.getDescription());
        d.setTargetType(r.getTargetType());
        d.setRequirementStatus(r.getRequirementStatus());
        d.setActive(r.isActive());
        d.setSortOrder(r.getSortOrder());
        d.setCreatedAt(r.getCreatedAt());
        d.setUpdatedAt(r.getUpdatedAt());
        return d;
    }
}


