package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.staff.StaffDocumentSummaryDTO;
import com.myhaimi.sms.DTO.staff.StaffDocumentUpdateDTO;
import com.myhaimi.sms.entity.*;
import com.myhaimi.sms.entity.enums.DocumentCollectionStatus;
import com.myhaimi.sms.entity.enums.DocumentUploadStatus;
import com.myhaimi.sms.entity.enums.DocumentVerificationStatus;
import com.myhaimi.sms.entity.enums.DocumentRequirementStatus;
import com.myhaimi.sms.entity.enums.DocumentTargetType;
import com.myhaimi.sms.entity.enums.VerificationSource;
import com.myhaimi.sms.repository.*;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service for the staff document checklist lifecycle.
 * <p>
 * Pattern mirrors {@code StudentService} document methods.
 * Access control is enforced via {@code @PreAuthorize} on the controller layer.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class StaffDocumentService {

    /**
     * Default document codes — must match codes seeded in V20260511180000 (STAFF target type).
     */
    private static final List<String> DEFAULT_STAFF_DOCUMENT_CODES = List.of(
            "PHOTO",
            "AADHAAR_ID_PROOF",
            "ADDRESS_PROOF",
            "QUALIFICATION_CERTIFICATE",
            "EXPERIENCE_LETTER",
            "APPOINTMENT_LETTER",
            "RESUME",
            "POLICE_VERIFICATION",
            "MEDICAL_FITNESS",
            "PAN_CARD",
            "BANK_PROOF"
    );

    private final StaffDocumentRepo documentRepo;
    private final StaffRepo         staffRepo;
    private final DocumentTypeRepo  documentTypeRepo;
    private final SchoolDocumentRequirementRepo requirementRepo;
    private final UserRepo          userRepo;

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Integer requireSchoolId() {
        Integer id = TenantContext.getSchoolId();
        if (id == null) throw new IllegalStateException("Missing school context");
        return id;
    }

    private Staff requireStaff(Integer staffId, Integer schoolId) {
        return staffRepo.findByIdAndSchool_IdAndIsDeletedFalse(staffId, schoolId)
                .orElseThrow(() -> new IllegalArgumentException("Staff member not found."));
    }

    private StaffDocument requireDoc(Integer docId, Integer staffId) {
        return documentRepo.findById(docId)
                .filter(d -> d.getStaff().getId().equals(staffId))
                .orElseThrow(() -> new IllegalArgumentException("Document not found for this staff member."));
    }

    /**
     * Resolves the staff ID of the currently authenticated user (for audit fields).
     * Returns null if the caller is not linked to a staff profile.
     */
    private Integer resolveCallerStaffId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) return null;
        Integer schoolId = TenantContext.getSchoolId();
        if (schoolId == null) return null;
        return userRepo.findFirstByEmailIgnoreCase(auth.getName())
                .map(u -> u.getLinkedStaff() != null ? u.getLinkedStaff().getId() : null)
                .orElse(null);
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Return the document checklist for a staff member.
     * Missing default rows are created on every call (idempotent).
     */
    @Transactional
    public List<StaffDocumentSummaryDTO> getDocuments(Integer staffId) {
        Integer schoolId = requireSchoolId();
        Staff staff = requireStaff(staffId, schoolId);
        ensureDefaultDocumentsExist(staff);
        return documentRepo.findByStaff_IdOrderByCreatedAtAsc(staffId)
                .stream()
                .map(this::toDTO)
                .toList();
    }

    /** Mark a document as physically collected. */
    @Transactional
    public StaffDocumentSummaryDTO collectDocument(Integer staffId, Integer docId, String remarks) {
        Integer schoolId = requireSchoolId();
        requireStaff(staffId, schoolId);
        StaffDocument doc = requireDoc(docId, staffId);

        doc.setCollectionStatus(DocumentCollectionStatus.COLLECTED_PHYSICAL);
        if (remarks != null && !remarks.isBlank()) doc.setRemarks(remarks.trim());
        documentRepo.save(doc);
        return toDTO(doc);
    }

    /**
     * Verify a document.
     * Guard: must be COLLECTED_PHYSICAL or UPLOADED before verification is allowed.
     */
    @Transactional
    public StaffDocumentSummaryDTO verifyDocument(Integer staffId, Integer docId,
                                                  String remarks, VerificationSource source) {
        Integer schoolId = requireSchoolId();
        requireStaff(staffId, schoolId);
        StaffDocument doc = requireDoc(docId, staffId);

        boolean collected = doc.getCollectionStatus() == DocumentCollectionStatus.COLLECTED_PHYSICAL;
        boolean uploaded  = doc.getUploadStatus()     == DocumentUploadStatus.UPLOADED;
        if (!collected && !uploaded) {
            throw new IllegalArgumentException(
                    "Cannot verify a document that has not been collected or uploaded.");
        }

        doc.setVerificationStatus(DocumentVerificationStatus.VERIFIED);
        doc.setVerifiedAt(Instant.now());
        doc.setVerificationSource(source != null ? source
                : (uploaded ? VerificationSource.UPLOADED_COPY : VerificationSource.PHYSICAL_ORIGINAL));
        doc.setVerifiedByStaffId(resolveCallerStaffId());
        if (remarks != null && !remarks.isBlank()) doc.setRemarks(remarks.trim());
        documentRepo.save(doc);
        return toDTO(doc);
    }

    /** Reject a document — remarks are mandatory. */
    @Transactional
    public StaffDocumentSummaryDTO rejectDocument(Integer staffId, Integer docId, String remarks) {
        Integer schoolId = requireSchoolId();
        requireStaff(staffId, schoolId);

        if (remarks == null || remarks.isBlank())
            throw new IllegalArgumentException("Rejection remarks are required.");

        StaffDocument doc = requireDoc(docId, staffId);
        doc.setVerificationStatus(DocumentVerificationStatus.REJECTED);
        doc.setVerifiedAt(Instant.now());
        doc.setVerifiedByStaffId(resolveCallerStaffId());
        doc.setRemarks(remarks.trim());
        documentRepo.save(doc);
        return toDTO(doc);
    }

    /** Waive a document — resets upload and verification state. */
    @Transactional
    public StaffDocumentSummaryDTO markNotRequired(Integer staffId, Integer docId) {
        Integer schoolId = requireSchoolId();
        requireStaff(staffId, schoolId);
        StaffDocument doc = requireDoc(docId, staffId);

        doc.setCollectionStatus(DocumentCollectionStatus.NOT_REQUIRED);
        doc.setUploadStatus(DocumentUploadStatus.NOT_UPLOADED);
        doc.setVerificationStatus(DocumentVerificationStatus.NOT_VERIFIED);
        doc.setVerificationSource(null);
        doc.setVerifiedAt(null);
        doc.setVerifiedByStaffId(null);
        documentRepo.save(doc);
        return toDTO(doc);
    }

    /** PATCH — partial update; only non-null fields are applied. */
    @Transactional
    public StaffDocumentSummaryDTO updateDocument(Integer staffId, Integer docId,
                                                  StaffDocumentUpdateDTO dto) {
        Integer schoolId = requireSchoolId();
        requireStaff(staffId, schoolId);
        StaffDocument doc = requireDoc(docId, staffId);

        if (dto.getCollectionStatus() != null)   doc.setCollectionStatus(dto.getCollectionStatus());
        if (dto.getUploadStatus() != null)        doc.setUploadStatus(dto.getUploadStatus());
        if (dto.getVerificationStatus() != null) {
            doc.setVerificationStatus(dto.getVerificationStatus());
            if (dto.getVerificationStatus() == DocumentVerificationStatus.VERIFIED
                    && doc.getVerifiedAt() == null) {
                doc.setVerifiedAt(Instant.now());
            }
        }
        if (dto.getRemarks() != null)
            doc.setRemarks(dto.getRemarks().isBlank() ? null : dto.getRemarks().trim());

        documentRepo.save(doc);
        return toDTO(doc);
    }

    /** Create any missing default document rows for a staff member.
     * @return List of created or updated document summaries
     */
    @Transactional
    public List<StaffDocumentSummaryDTO> seedDocuments(Integer staffId) {
        Integer schoolId = requireSchoolId();
        Staff staff = requireStaff(staffId, schoolId);
        ensureDefaultDocumentsExist(staff);
        return documentRepo.findByStaff_IdOrderByCreatedAtAsc(staffId)
                .stream()
                .map(this::toDTO)
                .toList();
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private void ensureDefaultDocumentsExist(Staff staff) {
        Integer schoolId = staff.getSchool().getId();

        Set<String> existing = documentRepo.findByStaff_IdOrderByCreatedAtAsc(staff.getId())
                .stream().map(StaffDocument::getDocumentType).collect(Collectors.toSet());

        for (DocumentType dt : resolveRequiredDocumentTypes(schoolId)) {
            if (!existing.contains(dt.getCode())) {
                StaffDocument doc = new StaffDocument();
                doc.setStaff(staff);
                doc.setDocumentType(dt.getCode());
                doc.setDocumentTypeId(dt.getId());
                doc.setCollectionStatus(DocumentCollectionStatus.PENDING_COLLECTION);
                doc.setUploadStatus(DocumentUploadStatus.NOT_UPLOADED);
                doc.setVerificationStatus(DocumentVerificationStatus.NOT_VERIFIED);
                documentRepo.save(doc);
            }
        }
    }

    private List<DocumentType> resolveRequiredDocumentTypes(Integer schoolId) {
        boolean hasSchoolConfig = requirementRepo.existsBySchoolIdAndTargetTypeAndActiveTrue(
                schoolId, DocumentTargetType.STAFF);

        if (hasSchoolConfig) {
            return requirementRepo
                    .findActiveChecklistRequirements(schoolId, DocumentTargetType.STAFF,
                            DocumentRequirementStatus.NOT_REQUIRED)
                    .stream()
                    .map(SchoolDocumentRequirement::getDocumentType)
                    .toList();
        }

        List<DocumentType> defaults = documentTypeRepo
                .findByTargetTypeAndActiveTrueOrderBySortOrderAsc(DocumentTargetType.STAFF);
        if (!defaults.isEmpty()) return defaults;

        // Synthetic fallback if migration hasn't run yet
        return DEFAULT_STAFF_DOCUMENT_CODES.stream()
                .map(code -> {
                    DocumentType dt = new DocumentType();
                    dt.setCode(code);
                    dt.setName(code.replace('_', ' '));
                    dt.setTargetType(DocumentTargetType.STAFF);
                    return dt;
                })
                .toList();
    }

    /**
     * Precedence: NOT_REQUIRED > REJECTED > VERIFIED > UPLOADED > COLLECTED_PHYSICAL > PENDING_COLLECTION.
     */
    static String computeDisplayStatus(StaffDocument doc) {
        DocumentCollectionStatus cs = doc.getCollectionStatus();
        if (cs == DocumentCollectionStatus.NOT_REQUIRED)      return "NOT_REQUIRED";
        DocumentVerificationStatus vs = doc.getVerificationStatus();
        if (vs == DocumentVerificationStatus.REJECTED)        return "REJECTED";
        if (vs == DocumentVerificationStatus.VERIFIED)        return "VERIFIED";
        DocumentUploadStatus us = doc.getUploadStatus();
        if (us == DocumentUploadStatus.UPLOADED)              return "UPLOADED";
        if (cs == DocumentCollectionStatus.COLLECTED_PHYSICAL) return "COLLECTED_PHYSICAL";
        return "PENDING_COLLECTION";
    }

    private StaffDocumentSummaryDTO toDTO(StaffDocument doc) {
        StaffDocumentSummaryDTO dto = new StaffDocumentSummaryDTO();
        dto.setId(doc.getId());
        dto.setDocumentType(doc.getDocumentType());

        DocumentType dtRef = doc.getDocumentTypeRef();
        if (dtRef != null) dto.setDocumentTypeName(dtRef.getName());

        dto.setFileId(doc.getFileId());
        dto.setCollectionStatus(doc.getCollectionStatus());
        dto.setUploadStatus(doc.getUploadStatus());
        dto.setVerificationStatus(doc.getVerificationStatus());
        dto.setVerificationSource(doc.getVerificationSource());
        dto.setDisplayStatus(computeDisplayStatus(doc));
        dto.setVerifiedByStaffId(doc.getVerifiedByStaffId());
        dto.setVerifiedAt(doc.getVerifiedAt());
        dto.setRemarks(doc.getRemarks());
        dto.setCreatedAt(doc.getCreatedAt());

        FileObject fo = doc.getFileObject();
        if (fo != null) {
            dto.setOriginalFilename(fo.getOriginalFilename());
            dto.setFileSize(fo.getFileSize());
            dto.setContentType(fo.getContentType());
            dto.setUploadedAt(fo.getUploadedAt());
        }
        return dto;
    }
}

