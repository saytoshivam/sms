package com.myhaimi.sms.student;

import com.myhaimi.sms.entity.School;
import com.myhaimi.sms.entity.Student;
import com.myhaimi.sms.entity.StudentDocument;
import com.myhaimi.sms.entity.enums.DocumentRequirementStatus;
import com.myhaimi.sms.entity.enums.DocumentTargetType;
import com.myhaimi.sms.entity.enums.DocumentCollectionStatus;
import com.myhaimi.sms.entity.enums.DocumentUploadStatus;
import com.myhaimi.sms.entity.enums.DocumentVerificationStatus;
import com.myhaimi.sms.modules.files.FileService;
import com.myhaimi.sms.repository.*;
import com.myhaimi.sms.service.impl.StudentAccessGuard;
import com.myhaimi.sms.service.impl.StudentCallerContext;
import com.myhaimi.sms.service.impl.StudentService;
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

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Pure unit tests for StudentService document lifecycle transitions.
 * All Spring beans (repos, guards) are mocked with Mockito.
 * TenantContext is set/cleared manually on the test thread.
 */
@ExtendWith(MockitoExtension.class)
class StudentDocumentLifecycleTest {

    // ── mocked dependencies ─────────────────────────────────────────────────────
    @Mock StudentRepo                      studentRepo;
    @Mock SchoolRepo                       schoolRepo;
    @Mock ClassGroupRepo                   classGroupRepo;
    @Mock GuardianRepo                     guardianRepo;
    @Mock StudentGuardianRepo              studentGuardianRepo;
    @Mock AcademicYearRepo                 academicYearRepo;
    @Mock StudentAcademicEnrollmentRepo    enrollmentRepo;
    @Mock StudentMedicalInfoRepo           medicalRepo;
    @Mock StudentDocumentRepo              documentRepo;
    @Mock UserRepo                         userRepo;
    @Mock StudentAccessGuard               accessGuard;
    @Mock FileService                      fileService;
    @Mock SchoolDocumentRequirementRepo    requirementRepo;
    @Mock DocumentTypeRepo                 documentTypeRepo;

    @InjectMocks
    StudentService service;

    // ── constants ───────────────────────────────────────────────────────────────
    private static final int SCHOOL_ID  = 1;
    private static final int STUDENT_ID = 10;
    private static final int DOC_ID     = 100;

    // ── fixtures ────────────────────────────────────────────────────────────────

    /** A StudentCallerContext that can edit documents (school-admin level). */
    private static StudentCallerContext editorCtx() {
        return new StudentCallerContext(
                "admin@school.com",
                Set.of("SCHOOL_ADMIN"),
                null, null, 42,      // linkedStudentId, linkedGuardianId, linkedStaffId
                null,                // allowedClassGroupIds=null means all classes
                true, true, true, true,   // canViewAnyStudent/canEdit/canTransfer/canCreateStudents
                true, true, true, true,   // canViewGuardians/canViewMedical/canViewDocuments/canViewFees
                true, true                // canManageParentLogin/canManageStudentLogin
        );
    }

    private Student stubStudent() {
        School school = new School();
        school.setId(SCHOOL_ID);

        Student s = new Student();
        s.setId(STUDENT_ID);
        s.setAdmissionNo("ADM001");
        s.setFirstName("Test");
        s.setSchool(school);
        return s;
    }

    private StudentDocument freshDoc(Student student) {
        StudentDocument doc = new StudentDocument();
        doc.setId(DOC_ID);
        doc.setStudent(student);
        doc.setDocumentType("BIRTH_CERTIFICATE");
        doc.setCollectionStatus(StudentDocumentCollectionStatus.PENDING_COLLECTION);
        doc.setUploadStatus(StudentDocumentUploadStatus.NOT_UPLOADED);
        doc.setVerificationStatus(StudentDocumentVerificationStatus.NOT_VERIFIED);
        return doc;
    }

    // ── setup / teardown ────────────────────────────────────────────────────────

    @BeforeEach
    void setupTenant() {
        TenantContext.setSchoolId(SCHOOL_ID);
    }

    @AfterEach
    void clearTenant() {
        TenantContext.clear();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 1. ensureDefaultDocumentsExist — new student
    // ═══════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("New student profile fetch creates 6 default document checklist rows (no school config)")
    void newStudent_gets6DefaultDocumentRows() {
        Student student = stubStudent();
        when(studentRepo.findById(STUDENT_ID)).thenReturn(Optional.of(student));

        // No school requirements configured — fall back to defaults
        when(requirementRepo.findActiveChecklistRequirements(
                SCHOOL_ID, DocumentTargetType.STUDENT, DocumentRequirementStatus.NOT_REQUIRED))
                .thenReturn(List.of());
        // DocumentType table also empty (seed not yet run on test DB) → synthetic fallback
        when(documentTypeRepo.findByCodeAndTargetType(any(), any()))
                .thenReturn(Optional.empty());

        // No existing documents
        when(documentRepo.findByStudent_IdOrderByCreatedAtDesc(STUDENT_ID))
                .thenReturn(List.of());
        when(documentRepo.save(any(StudentDocument.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        service.ensureDefaultDocumentsExistForStudent(STUDENT_ID);

        // 6 saves expected (one per default doc type)
        ArgumentCaptor<StudentDocument> captor = ArgumentCaptor.forClass(StudentDocument.class);
        verify(documentRepo, times(6)).save(captor.capture());

        List<String> savedTypes = captor.getAllValues().stream()
                .map(StudentDocument::getDocumentType)
                .distinct()
                .toList();
        assertThat(savedTypes).containsExactlyInAnyOrder(
                "BIRTH_CERTIFICATE",
                "AADHAAR_CARD",
                "TRANSFER_CERTIFICATE",
                "PREVIOUS_MARKSHEET",
                "PARENT_ID_PROOF",
                "ADDRESS_PROOF"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. ensureDefaultDocumentsExist — old student
    // ═══════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("Old student profile fetch only creates missing document rows, skips existing ones")
    void oldStudent_onlyMissingDocumentsCreated() {
        Student student = stubStudent();
        when(studentRepo.findById(STUDENT_ID)).thenReturn(Optional.of(student));

        // No school requirements configured — fall back to defaults
        when(requirementRepo.findActiveChecklistRequirements(
                SCHOOL_ID, DocumentTargetType.STUDENT, DocumentRequirementStatus.NOT_REQUIRED))
                .thenReturn(List.of());
        when(documentTypeRepo.findByCodeAndTargetType(any(), any()))
                .thenReturn(Optional.empty());

        // Two existing documents already present
        StudentDocument existing1 = new StudentDocument();
        existing1.setDocumentType("BIRTH_CERTIFICATE");
        StudentDocument existing2 = new StudentDocument();
        existing2.setDocumentType("AADHAAR_CARD");

        when(documentRepo.findByStudent_IdOrderByCreatedAtDesc(STUDENT_ID))
                .thenReturn(List.of(existing1, existing2));
        when(documentRepo.save(any(StudentDocument.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        service.ensureDefaultDocumentsExistForStudent(STUDENT_ID);

        // Only 4 new docs created (6 total minus the 2 already present)
        ArgumentCaptor<StudentDocument> captor = ArgumentCaptor.forClass(StudentDocument.class);
        verify(documentRepo, times(4)).save(captor.capture());

        List<String> savedTypes = captor.getAllValues().stream()
                .map(StudentDocument::getDocumentType)
                .toList();
        assertThat(savedTypes).doesNotContain("BIRTH_CERTIFICATE", "AADHAAR_CARD");
        assertThat(savedTypes).containsExactlyInAnyOrder(
                "TRANSFER_CERTIFICATE",
                "PREVIOUS_MARKSHEET",
                "PARENT_ID_PROOF",
                "ADDRESS_PROOF"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. verifyDocument — cannot verify when neither collected nor uploaded
    // ═══════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("Cannot verify a document that is neither collected nor uploaded")
    void cannotVerify_pendingDocument() {
        Student student = stubStudent();
        StudentDocument doc = freshDoc(student); // PENDING_COLLECTION + NOT_UPLOADED

        when(accessGuard.resolve(SCHOOL_ID)).thenReturn(editorCtx());
        when(studentRepo.findByIdAndSchool_Id(STUDENT_ID, SCHOOL_ID))
                .thenReturn(Optional.of(student));
        when(documentRepo.findById(DOC_ID)).thenReturn(Optional.of(doc));

        assertThatThrownBy(() -> service.verifyDocument(STUDENT_ID, DOC_ID, null, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("collected or uploaded before verification");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 4. verifyDocument — succeeds when physically collected
    // ═══════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("Can verify a physically collected document")
    void canVerify_collectedPhysicalDocument() {
        Student student = stubStudent();
        StudentDocument doc = freshDoc(student);
        doc.setCollectionStatus(StudentDocumentCollectionStatus.COLLECTED_PHYSICAL);

        when(accessGuard.resolve(SCHOOL_ID)).thenReturn(editorCtx());
        when(studentRepo.findByIdAndSchool_Id(STUDENT_ID, SCHOOL_ID))
                .thenReturn(Optional.of(student));
        when(documentRepo.findById(DOC_ID)).thenReturn(Optional.of(doc));
        when(documentRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var result = service.verifyDocument(STUDENT_ID, DOC_ID, "Looks good", null);

        assertThat(result.getVerificationStatus()).isEqualTo(StudentDocumentVerificationStatus.VERIFIED);
        assertThat(result.getVerificationSource()).isEqualTo(com.myhaimi.sms.entity.enums.VerificationSource.PHYSICAL_ORIGINAL);
        assertThat(result.getVerifiedAt()).isNotNull();
        assertThat(result.getVerifiedByStaffId()).isEqualTo(42); // staffId from editorCtx
        assertThat(result.getRemarks()).isEqualTo("Looks good");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 5. markDocumentNotRequired — clears verification state
    // ═══════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("markNotRequired resets upload and verification state to defaults")
    void markNotRequired_clearsVerificationState() {
        Student student = stubStudent();
        StudentDocument doc = freshDoc(student);
        // Simulate a previously verified document
        doc.setVerificationStatus(StudentDocumentVerificationStatus.VERIFIED);
        doc.setVerifiedAt(Instant.now());
        doc.setVerifiedByStaffId(99);

        when(accessGuard.resolve(SCHOOL_ID)).thenReturn(editorCtx());
        when(studentRepo.findByIdAndSchool_Id(STUDENT_ID, SCHOOL_ID))
                .thenReturn(Optional.of(student));
        when(documentRepo.findById(DOC_ID)).thenReturn(Optional.of(doc));
        when(documentRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var result = service.markDocumentNotRequired(STUDENT_ID, DOC_ID);

        assertThat(result.getCollectionStatus()).isEqualTo(StudentDocumentCollectionStatus.NOT_REQUIRED);
        assertThat(result.getUploadStatus()).isEqualTo(StudentDocumentUploadStatus.NOT_UPLOADED);
        assertThat(result.getVerificationStatus()).isEqualTo(StudentDocumentVerificationStatus.NOT_VERIFIED);
        assertThat(result.getVerifiedAt()).isNull();
        assertThat(result.getVerifiedByStaffId()).isNull();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 6. markDocumentPending — clears verification state
    // ═══════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("markPending resets verification state but preserves fileUrl if present")
    void markPending_clearsVerificationState() {
        Student student = stubStudent();
        StudentDocument doc = freshDoc(student);
        // Simulate a verified document being rolled back
        doc.setCollectionStatus(StudentDocumentCollectionStatus.COLLECTED_PHYSICAL);
        doc.setVerificationStatus(StudentDocumentVerificationStatus.VERIFIED);
        doc.setVerifiedAt(Instant.now());
        doc.setVerifiedByStaffId(42);
        doc.setFileUrl("http://example.com/file.pdf");
        doc.setUploadStatus(StudentDocumentUploadStatus.UPLOADED);

        when(accessGuard.resolve(SCHOOL_ID)).thenReturn(editorCtx());
        when(studentRepo.findByIdAndSchool_Id(STUDENT_ID, SCHOOL_ID))
                .thenReturn(Optional.of(student));
        when(documentRepo.findById(DOC_ID)).thenReturn(Optional.of(doc));
        when(documentRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var result = service.markDocumentPending(STUDENT_ID, DOC_ID);

        assertThat(result.getCollectionStatus()).isEqualTo(StudentDocumentCollectionStatus.PENDING_COLLECTION);
        assertThat(result.getVerificationStatus()).isEqualTo(StudentDocumentVerificationStatus.NOT_VERIFIED);
        assertThat(result.getVerifiedAt()).isNull();
        assertThat(result.getVerifiedByStaffId()).isNull();
        // fileUrl / uploadStatus are preserved (not touched by markPending)
        assertThat(result.getFileUrl()).isEqualTo("http://example.com/file.pdf");
        assertThat(result.getUploadStatus()).isEqualTo(StudentDocumentUploadStatus.UPLOADED);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 7. rejectDocument — requires non-blank remarks
    // ═══════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("rejectDocument throws when remarks are blank")
    void reject_requiresRemarks_blankThrows() {
        when(accessGuard.resolve(SCHOOL_ID)).thenReturn(editorCtx());

        assertThatThrownBy(() -> service.rejectDocument(STUDENT_ID, DOC_ID, "   "))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Rejection remarks are required");
    }

    @Test
    @DisplayName("rejectDocument throws when remarks are null")
    void reject_requiresRemarks_nullThrows() {
        when(accessGuard.resolve(SCHOOL_ID)).thenReturn(editorCtx());

        assertThatThrownBy(() -> service.rejectDocument(STUDENT_ID, DOC_ID, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Rejection remarks are required");
    }

    @Test
    @DisplayName("rejectDocument sets REJECTED status with verifiedAt timestamp and remarks")
    void reject_setsRejectedWithTimestamp() {
        Student student = stubStudent();
        StudentDocument doc = freshDoc(student);
        doc.setCollectionStatus(StudentDocumentCollectionStatus.COLLECTED_PHYSICAL);

        when(accessGuard.resolve(SCHOOL_ID)).thenReturn(editorCtx());
        when(studentRepo.findByIdAndSchool_Id(STUDENT_ID, SCHOOL_ID))
                .thenReturn(Optional.of(student));
        when(documentRepo.findById(DOC_ID)).thenReturn(Optional.of(doc));
        when(documentRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var result = service.rejectDocument(STUDENT_ID, DOC_ID, "Missing page 2");

        assertThat(result.getVerificationStatus()).isEqualTo(StudentDocumentVerificationStatus.REJECTED);
        assertThat(result.getVerifiedAt()).isNotNull();
        assertThat(result.getVerifiedByStaffId()).isEqualTo(42); // staffId from editorCtx
        assertThat(result.getRemarks()).isEqualTo("Missing page 2");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 8. updateDocument — cross-student boundary check
    // ═══════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("updateDocument rejects documents belonging to a different student")
    void updateDocument_crossStudentBoundaryRejected() {
        Student student = stubStudent(); // STUDENT_ID = 10

        // Document belongs to student 99, not student 10
        Student otherStudent = new Student();
        otherStudent.setId(99);
        StudentDocument docOfOther = new StudentDocument();
        docOfOther.setId(DOC_ID);
        docOfOther.setStudent(otherStudent);
        docOfOther.setDocumentType("AADHAAR_CARD");
        docOfOther.setCollectionStatus(StudentDocumentCollectionStatus.PENDING_COLLECTION);
        docOfOther.setUploadStatus(StudentDocumentUploadStatus.NOT_UPLOADED);
        docOfOther.setVerificationStatus(StudentDocumentVerificationStatus.NOT_VERIFIED);

        when(accessGuard.resolve(SCHOOL_ID)).thenReturn(editorCtx());
        when(studentRepo.findByIdAndSchool_Id(STUDENT_ID, SCHOOL_ID))
                .thenReturn(Optional.of(student));
        when(documentRepo.findById(DOC_ID)).thenReturn(Optional.of(docOfOther));

        var dto = new com.myhaimi.sms.DTO.student.StudentDocumentUpdateDTO();

        assertThatThrownBy(() -> service.updateDocument(STUDENT_ID, DOC_ID, dto))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Document not found for this student");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 9. computeDisplayStatus — precedence
    // ═══════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("NOT_REQUIRED takes highest display precedence even when verification is VERIFIED")
    void displayStatus_notRequired_winsOverVerified() {
        StudentDocument doc = new StudentDocument();
        doc.setCollectionStatus(StudentDocumentCollectionStatus.NOT_REQUIRED);
        doc.setUploadStatus(StudentDocumentUploadStatus.NOT_UPLOADED);
        doc.setVerificationStatus(StudentDocumentVerificationStatus.VERIFIED); // shouldn't matter

        assertThat(StudentService.computeDisplayStatus(doc)).isEqualTo("NOT_REQUIRED");
    }

    @Test
    @DisplayName("REJECTED appears before VERIFIED when collection is not NOT_REQUIRED")
    void displayStatus_rejectedBeforeVerified() {
        StudentDocument doc = new StudentDocument();
        doc.setCollectionStatus(StudentDocumentCollectionStatus.COLLECTED_PHYSICAL);
        doc.setUploadStatus(StudentDocumentUploadStatus.NOT_UPLOADED);
        doc.setVerificationStatus(StudentDocumentVerificationStatus.REJECTED);

        assertThat(StudentService.computeDisplayStatus(doc)).isEqualTo("REJECTED");
    }

    @Test
    @DisplayName("VERIFIED shows correctly when document is collected and verified")
    void displayStatus_verifiedWhenCollectedAndVerified() {
        StudentDocument doc = new StudentDocument();
        doc.setCollectionStatus(StudentDocumentCollectionStatus.COLLECTED_PHYSICAL);
        doc.setUploadStatus(StudentDocumentUploadStatus.NOT_UPLOADED);
        doc.setVerificationStatus(StudentDocumentVerificationStatus.VERIFIED);

        assertThat(StudentService.computeDisplayStatus(doc)).isEqualTo("VERIFIED");
    }

    @Test
    @DisplayName("UPLOADED shows when upload status is UPLOADED and not yet verified")
    void displayStatus_uploadedBeforeCollectedPhysical() {
        StudentDocument doc = new StudentDocument();
        doc.setCollectionStatus(StudentDocumentCollectionStatus.PENDING_COLLECTION);
        doc.setUploadStatus(StudentDocumentUploadStatus.UPLOADED);
        doc.setVerificationStatus(StudentDocumentVerificationStatus.NOT_VERIFIED);

        assertThat(StudentService.computeDisplayStatus(doc)).isEqualTo("UPLOADED");
    }

    @Test
    @DisplayName("PENDING_COLLECTION is the fallback display status")
    void displayStatus_pendingIsFallback() {
        StudentDocument doc = new StudentDocument();
        doc.setCollectionStatus(StudentDocumentCollectionStatus.PENDING_COLLECTION);
        doc.setUploadStatus(StudentDocumentUploadStatus.NOT_UPLOADED);
        doc.setVerificationStatus(StudentDocumentVerificationStatus.NOT_VERIFIED);

        assertThat(StudentService.computeDisplayStatus(doc)).isEqualTo("PENDING_COLLECTION");
    }
}

