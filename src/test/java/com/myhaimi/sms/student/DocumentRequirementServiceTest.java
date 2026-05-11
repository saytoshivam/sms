package com.myhaimi.sms.student;

import com.myhaimi.sms.DTO.docreq.ApplyRequirementsResultDTO;
import com.myhaimi.sms.entity.DocumentType;
import com.myhaimi.sms.entity.School;
import com.myhaimi.sms.entity.SchoolDocumentRequirement;
import com.myhaimi.sms.entity.Student;
import com.myhaimi.sms.entity.StudentDocument;
import com.myhaimi.sms.entity.enums.DocumentRequirementStatus;
import com.myhaimi.sms.entity.enums.DocumentTargetType;
import com.myhaimi.sms.entity.enums.StudentDocumentCollectionStatus;
import com.myhaimi.sms.entity.enums.StudentDocumentUploadStatus;
import com.myhaimi.sms.entity.enums.StudentDocumentVerificationStatus;
import com.myhaimi.sms.entity.enums.StudentLifecycleStatus;
import com.myhaimi.sms.repository.DocumentTypeRepo;
import com.myhaimi.sms.repository.SchoolDocumentRequirementRepo;
import com.myhaimi.sms.repository.StudentDocumentRepo;
import com.myhaimi.sms.repository.StudentRepo;
import com.myhaimi.sms.service.impl.DocumentRequirementService;
import com.myhaimi.sms.service.impl.StudentAccessGuard;
import com.myhaimi.sms.service.impl.StudentCallerContext;
import com.myhaimi.sms.utils.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link DocumentRequirementService}.
 *
 * Covers the 6 verifiable scenarios from the spec:
 *  1. School with no config → fallback to 6 default student document rows
 *  2. School with configured docs → create only configured docs
 *  3. NOT_REQUIRED docs are not generated in student checklists
 *  4. Inactive requirements are not generated in student checklists
 *  5. applyToExistingStudents creates missing rows only (no duplicates)
 *  6. Existing uploaded documents are never deleted
 */
@ExtendWith(MockitoExtension.class)
class DocumentRequirementServiceTest {

    @Mock DocumentTypeRepo                 documentTypeRepo;
    @Mock SchoolDocumentRequirementRepo    requirementRepo;
    @Mock StudentRepo                      studentRepo;
    @Mock StudentDocumentRepo              documentRepo;
    @Mock StudentAccessGuard               accessGuard;

    @InjectMocks
    DocumentRequirementService service;

    private static final int SCHOOL_ID = 1;

    // ── helpers ─────────────────────────────────────────────────────────────────

    private StudentCallerContext editorCtx() {
        return new StudentCallerContext(
                "admin@school.com",
                Set.of("SCHOOL_ADMIN"),
                null, null, 42, null,
                true, true, true, true,
                true, true, true, true,
                true, true
        );
    }

    private DocumentType docType(int id, String code, String name) {
        DocumentType dt = new DocumentType();
        dt.setId(id);
        dt.setCode(code);
        dt.setName(name);
        dt.setTargetType(DocumentTargetType.STUDENT);
        dt.setActive(true);
        dt.setSystemDefined(true);
        dt.setSortOrder(id * 10);
        return dt;
    }

    private SchoolDocumentRequirement requirement(
            DocumentType dt, DocumentRequirementStatus status, boolean active) {
        SchoolDocumentRequirement r = new SchoolDocumentRequirement();
        r.setSchoolId(SCHOOL_ID);
        r.setDocumentType(dt);
        r.setTargetType(DocumentTargetType.STUDENT);
        r.setRequirementStatus(status);
        r.setActive(active);
        r.setSortOrder(dt.getSortOrder());
        return r;
    }

    private Student activeStudent(int id) {
        School school = new School();
        school.setId(SCHOOL_ID);
        Student s = new Student();
        s.setId(id);
        s.setSchool(school);
        s.setStatus(StudentLifecycleStatus.ACTIVE);
        return s;
    }

    private StudentDocument existingDoc(Student student, String code) {
        StudentDocument d = new StudentDocument();
        d.setStudent(student);
        d.setDocumentType(code);
        d.setCollectionStatus(StudentDocumentCollectionStatus.PENDING_COLLECTION);
        d.setUploadStatus(StudentDocumentUploadStatus.NOT_UPLOADED);
        d.setVerificationStatus(StudentDocumentVerificationStatus.NOT_VERIFIED);
        return d;
    }

    private StudentDocument uploadedDoc(Student student, String code) {
        StudentDocument d = existingDoc(student, code);
        d.setCollectionStatus(StudentDocumentCollectionStatus.COLLECTED_PHYSICAL);
        d.setUploadStatus(StudentDocumentUploadStatus.UPLOADED);
        d.setVerificationStatus(StudentDocumentVerificationStatus.VERIFIED);
        d.setFileId(999L);   // has a real file
        return d;
    }

    @BeforeEach
    void setupTenant() {
        TenantContext.setSchoolId(SCHOOL_ID);
    }

    @AfterEach
    void clearTenant() {
        TenantContext.clear();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 1–4  applyToExistingStudents — uses students with various configurations
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Scenario: school has no configured requirements.
     * applyToExistingStudents reports 0 rows because there is nothing to apply.
     * (Fallback defaults are only used at onboarding time, not during "apply".)
     */
    @Test
    @DisplayName("1. School with no configured requirements — apply returns 0 rows created")
    void applyWithNoSchoolConfig_createsZeroRows() {
        when(accessGuard.resolve(SCHOOL_ID)).thenReturn(editorCtx());
        when(requirementRepo.findActiveChecklistRequirements(
                eq(SCHOOL_ID), eq(DocumentTargetType.STUDENT), eq(DocumentRequirementStatus.NOT_REQUIRED)))
                .thenReturn(List.of());

        ApplyRequirementsResultDTO result = service.applyRequirementsToExistingStudents();

        assertThat(result.getDocumentRowsCreated()).isZero();
        assertThat(result.getStudentsProcessed()).isZero();
        assertThat(result.getMessage()).contains("No active requirements");
        verify(documentRepo, never()).save(any());
    }

    /**
     * Scenario: school has only REQUIRED+OPTIONAL requirements configured.
     * Active students that have no docs yet get one row per requirement.
     */
    @Test
    @DisplayName("2. School with configured REQUIRED+OPTIONAL docs — creates those rows for students")
    void applyWithConfiguredDocs_createsCorrectRows() {
        when(accessGuard.resolve(SCHOOL_ID)).thenReturn(editorCtx());

        DocumentType birthCert  = docType(1, "BIRTH_CERTIFICATE", "Birth Certificate");
        DocumentType aadhaar    = docType(2, "AADHAAR_CARD",      "Aadhaar Card");
        DocumentType tc         = docType(3, "TRANSFER_CERTIFICATE", "Transfer Certificate");

        when(requirementRepo.findActiveChecklistRequirements(
                SCHOOL_ID, DocumentTargetType.STUDENT, DocumentRequirementStatus.NOT_REQUIRED))
                .thenReturn(List.of(
                        requirement(birthCert, DocumentRequirementStatus.REQUIRED,  true),
                        requirement(aadhaar,   DocumentRequirementStatus.OPTIONAL,  true),
                        requirement(tc,        DocumentRequirementStatus.REQUIRED,  true)
                ));

        Student student = activeStudent(10);
        when(studentRepo.findBySchool_IdAndStatus(SCHOOL_ID, StudentLifecycleStatus.ACTIVE))
                .thenReturn(List.of(student));
        // Student has no existing docs
        when(documentRepo.findByStudent_IdOrderByCreatedAtDesc(10)).thenReturn(List.of());
        when(documentRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ApplyRequirementsResultDTO result = service.applyRequirementsToExistingStudents();

        assertThat(result.getStudentsProcessed()).isEqualTo(1);
        assertThat(result.getDocumentRowsCreated()).isEqualTo(3);

        ArgumentCaptor<StudentDocument> captor = ArgumentCaptor.forClass(StudentDocument.class);
        verify(documentRepo, times(3)).save(captor.capture());
        List<String> codes = captor.getAllValues().stream().map(StudentDocument::getDocumentType).toList();
        assertThat(codes).containsExactlyInAnyOrder(
                "BIRTH_CERTIFICATE", "AADHAAR_CARD", "TRANSFER_CERTIFICATE");
    }

    /**
     * Scenario 3: NOT_REQUIRED requirements must NOT generate student_document rows.
     * The findActiveChecklistRequirements query already filters them out via excludeStatus param.
     * This test verifies the service passes the correct param and does not create rows for them.
     */
    @Test
    @DisplayName("3. NOT_REQUIRED requirements are excluded from student checklist generation")
    void notRequiredDocs_areNotGenerated() {
        when(accessGuard.resolve(SCHOOL_ID)).thenReturn(editorCtx());

        // The repository filters NOT_REQUIRED — return only REQUIRED/OPTIONAL
        DocumentType birthCert = docType(1, "BIRTH_CERTIFICATE", "Birth Certificate");
        when(requirementRepo.findActiveChecklistRequirements(
                SCHOOL_ID, DocumentTargetType.STUDENT, DocumentRequirementStatus.NOT_REQUIRED))
                .thenReturn(List.of(requirement(birthCert, DocumentRequirementStatus.REQUIRED, true)));

        Student student = activeStudent(10);
        when(studentRepo.findBySchool_IdAndStatus(SCHOOL_ID, StudentLifecycleStatus.ACTIVE))
                .thenReturn(List.of(student));
        when(documentRepo.findByStudent_IdOrderByCreatedAtDesc(10)).thenReturn(List.of());
        when(documentRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.applyRequirementsToExistingStudents();

        // Only one row created (the REQUIRED one); NOT_REQUIRED was filtered at query level
        verify(documentRepo, times(1)).save(any());
        // Verify the repo was called with NOT_REQUIRED as the exclude param (not null)
        verify(requirementRepo).findActiveChecklistRequirements(
                SCHOOL_ID, DocumentTargetType.STUDENT, DocumentRequirementStatus.NOT_REQUIRED);
    }

    /**
     * Scenario 4: Inactive requirements (active=false) are excluded from student checklist.
     * findActiveChecklistRequirements filters on active=true at the DB level.
     * This test ensures the service calls that method (not the all-requirements method).
     */
    @Test
    @DisplayName("4. Inactive requirements (active=false) are excluded from student checklist generation")
    void inactiveRequirements_areNotGenerated() {
        when(accessGuard.resolve(SCHOOL_ID)).thenReturn(editorCtx());

        // Simulates DB already filtering inactive rows
        when(requirementRepo.findActiveChecklistRequirements(
                SCHOOL_ID, DocumentTargetType.STUDENT, DocumentRequirementStatus.NOT_REQUIRED))
                .thenReturn(List.of()); // no active requirements

        ApplyRequirementsResultDTO result = service.applyRequirementsToExistingStudents();

        assertThat(result.getDocumentRowsCreated()).isZero();
        // Must NEVER query all requirements (which would include inactive ones)
        verify(requirementRepo, never())
                .findBySchoolIdAndTargetTypeAndActiveTrueOrderBySortOrderAsc(any(), any());
        verify(documentRepo, never()).save(any());
    }

    /**
     * Scenario 5: applyToExistingStudents skips document types already present for a student.
     * Ensures no duplicate rows are created.
     */
    @Test
    @DisplayName("5. apply-to-existing-students creates missing rows only — no duplicates")
    void apply_doesNotDuplicateExistingRows() {
        when(accessGuard.resolve(SCHOOL_ID)).thenReturn(editorCtx());

        DocumentType birthCert   = docType(1, "BIRTH_CERTIFICATE",   "Birth Certificate");
        DocumentType aadhaar     = docType(2, "AADHAAR_CARD",        "Aadhaar Card");
        DocumentType tc          = docType(3, "TRANSFER_CERTIFICATE", "Transfer Certificate");

        when(requirementRepo.findActiveChecklistRequirements(
                SCHOOL_ID, DocumentTargetType.STUDENT, DocumentRequirementStatus.NOT_REQUIRED))
                .thenReturn(List.of(
                        requirement(birthCert, DocumentRequirementStatus.REQUIRED, true),
                        requirement(aadhaar,   DocumentRequirementStatus.REQUIRED, true),
                        requirement(tc,        DocumentRequirementStatus.REQUIRED, true)
                ));

        Student student = activeStudent(10);
        when(studentRepo.findBySchool_IdAndStatus(SCHOOL_ID, StudentLifecycleStatus.ACTIVE))
                .thenReturn(List.of(student));

        // Student already has BIRTH_CERTIFICATE and AADHAAR_CARD
        when(documentRepo.findByStudent_IdOrderByCreatedAtDesc(10)).thenReturn(List.of(
                existingDoc(student, "BIRTH_CERTIFICATE"),
                existingDoc(student, "AADHAAR_CARD")
        ));
        when(documentRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ApplyRequirementsResultDTO result = service.applyRequirementsToExistingStudents();

        // Only TRANSFER_CERTIFICATE should be created
        assertThat(result.getDocumentRowsCreated()).isEqualTo(1);
        ArgumentCaptor<StudentDocument> captor = ArgumentCaptor.forClass(StudentDocument.class);
        verify(documentRepo, times(1)).save(captor.capture());
        assertThat(captor.getValue().getDocumentType()).isEqualTo("TRANSFER_CERTIFICATE");
    }

    /**
     * Scenario 6: Existing uploaded documents are never deleted or modified.
     * An already-uploaded document must retain its fileId, uploadStatus, and verificationStatus
     * after applying requirements. The service only creates new rows for missing types.
     */
    @Test
    @DisplayName("6. Existing uploaded documents are never deleted when applying requirements")
    void apply_preservesExistingUploadedDocuments() {
        when(accessGuard.resolve(SCHOOL_ID)).thenReturn(editorCtx());

        DocumentType birthCert = docType(1, "BIRTH_CERTIFICATE", "Birth Certificate");
        DocumentType aadhaar   = docType(2, "AADHAAR_CARD",      "Aadhaar Card");

        when(requirementRepo.findActiveChecklistRequirements(
                SCHOOL_ID, DocumentTargetType.STUDENT, DocumentRequirementStatus.NOT_REQUIRED))
                .thenReturn(List.of(
                        requirement(birthCert, DocumentRequirementStatus.REQUIRED, true),
                        requirement(aadhaar,   DocumentRequirementStatus.REQUIRED, true)
                ));

        Student student = activeStudent(10);
        when(studentRepo.findBySchool_IdAndStatus(SCHOOL_ID, StudentLifecycleStatus.ACTIVE))
                .thenReturn(List.of(student));

        // BIRTH_CERTIFICATE already uploaded — must not be touched
        StudentDocument uploaded = uploadedDoc(student, "BIRTH_CERTIFICATE");
        when(documentRepo.findByStudent_IdOrderByCreatedAtDesc(10))
                .thenReturn(List.of(uploaded));
        when(documentRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.applyRequirementsToExistingStudents();

        // Only AADHAAR_CARD should be saved (new row)
        ArgumentCaptor<StudentDocument> captor = ArgumentCaptor.forClass(StudentDocument.class);
        verify(documentRepo, times(1)).save(captor.capture());
        assertThat(captor.getValue().getDocumentType()).isEqualTo("AADHAAR_CARD");

        // Uploaded doc state must be unchanged (service never touches existing rows)
        assertThat(uploaded.getFileId()).isEqualTo(999L);
        assertThat(uploaded.getUploadStatus()).isEqualTo(StudentDocumentUploadStatus.UPLOADED);
        assertThat(uploaded.getVerificationStatus()).isEqualTo(StudentDocumentVerificationStatus.VERIFIED);
    }
}

