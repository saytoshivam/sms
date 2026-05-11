package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.student.StudentRosterHealthDTO;
import com.myhaimi.sms.DTO.StudentViewDTO;
import com.myhaimi.sms.DTO.student.*;
import com.myhaimi.sms.entity.*;
import com.myhaimi.sms.entity.enums.StudentAcademicEnrollmentStatus;
import com.myhaimi.sms.entity.enums.StudentDocumentStatus;
import com.myhaimi.sms.entity.enums.StudentDocumentCollectionStatus;
import com.myhaimi.sms.entity.enums.StudentDocumentUploadStatus;
import com.myhaimi.sms.entity.enums.StudentDocumentVerificationStatus;
import com.myhaimi.sms.entity.enums.DocumentTargetType;
import com.myhaimi.sms.entity.enums.DocumentRequirementStatus;
import com.myhaimi.sms.entity.FileObject;
import com.myhaimi.sms.entity.enums.StudentLifecycleStatus;
import com.myhaimi.sms.entity.enums.GuardianLoginStatus;
import com.myhaimi.sms.entity.enums.FileCategory;
import com.myhaimi.sms.entity.enums.FileVisibility;
import com.myhaimi.sms.modules.files.FileObjectDTO;
import com.myhaimi.sms.modules.files.FileService;
import com.myhaimi.sms.repository.*;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class StudentService {

    private final StudentRepo studentRepo;
    private final SchoolRepo schoolRepo;
    private final ClassGroupRepo classGroupRepo;
    private final GuardianRepo guardianRepo;
    private final StudentGuardianRepo studentGuardianRepo;
    private final AcademicYearRepo academicYearRepo;
    private final StudentAcademicEnrollmentRepo enrollmentRepo;
    private final StudentMedicalInfoRepo medicalRepo;
    private final StudentDocumentRepo documentRepo;
    private final UserRepo userRepo;
    private final StudentAccessGuard accessGuard;
    private final FileService fileService;
    private final SchoolDocumentRequirementRepo requirementRepo;
    private final DocumentTypeRepo documentTypeRepo;

    /**
     * Fallback document codes used when a school has not yet configured any document requirements.
     * These match the system-seeded document_types table rows for STUDENT target type.
     */
    private static final List<String> DEFAULT_DOCUMENT_CODES = Arrays.asList(
            "BIRTH_CERTIFICATE",
            "AADHAAR_CARD",
            "TRANSFER_CERTIFICATE",
            "PREVIOUS_MARKSHEET",
            "PARENT_ID_PROOF",
            "ADDRESS_PROOF"
    );

    private Integer requireSchoolId() {
        Integer schoolId = TenantContext.getSchoolId();
        if (schoolId == null) throw new IllegalStateException("Missing school context");
        return schoolId;
    }

    public Page<StudentViewDTO> list(
            Pageable pageable,
            Integer classGroupId,
            StudentLifecycleStatus status,
            Integer gradeLevel,
            String section,
            String search,
            boolean noGuardian,
            boolean noSection) {
        Integer schoolId = requireSchoolId();
        StudentCallerContext ctx = accessGuard.resolve(schoolId);

        Specification<Student> spec = Specification.where(StudentSpecs.forSchool(schoolId))
                .and(StudentSpecs.classGroup(classGroupId))
                .and(StudentSpecs.classGroupGradeLevel(gradeLevel))
                .and(StudentSpecs.classGroupSection(section))
                .and(StudentSpecs.lifecycleStatus(status))
                .and(StudentSpecs.studentListSearch(search));

        if (noGuardian) spec = spec.and(StudentSpecs.hasNoGuardian());
        if (noSection)  spec = spec.and(StudentSpecs.hasNoSection());

        // Apply row-level visibility based on caller role
        if (ctx.isParent()) {
            if (ctx.linkedGuardianId() == null) return Page.empty(pageable);
            Set<Integer> childIds = studentGuardianRepo.findByGuardian_Id(ctx.linkedGuardianId())
                    .stream().map(sg -> sg.getStudent().getId())
                    .collect(Collectors.toSet());
            spec = spec.and(StudentSpecs.studentIdIn(childIds));
        } else if (ctx.isStudent()) {
            if (ctx.linkedStudentId() == null) return Page.empty(pageable);
            spec = spec.and(StudentSpecs.studentIdIn(Set.of(ctx.linkedStudentId())));
        } else if (!ctx.canViewAnyStudent()) {
            spec = spec.and(StudentSpecs.restrictedToClassGroups(ctx.allowedClassGroupIds()));
        }

        Page<Student> page = studentRepo.findAll(spec, pageable);
        List<StudentViewDTO> rows = enrichListRows(page.getContent(), schoolId);
        return new PageImpl<>(rows, page.getPageable(), page.getTotalElements());
    }

    /** Aggregate dashboard counts for the student module landing page. */
    public StudentRosterHealthDTO rosterHealth() {
        Integer schoolId = requireSchoolId();
        // Anyone with school access can see aggregate counts (no personal data exposed)
        java.time.Instant startOfMonth = LocalDate.now()
                .withDayOfMonth(1)
                .atStartOfDay(ZoneId.systemDefault())
                .toInstant();
        return StudentRosterHealthDTO.builder()
                .activeCount(studentRepo.countBySchool_IdAndStatus(schoolId, StudentLifecycleStatus.ACTIVE))
                .newThisMonthCount(studentRepo.countCreatedBetween(schoolId, startOfMonth,
                        java.time.Instant.now().plusSeconds(86_400)))
                .missingGuardianCount(studentRepo.countBySchool_IdAndNoGuardian(schoolId))
                .noSectionCount(studentRepo.countBySchool_IdAndNoSection(schoolId))
                .inactiveCount(studentRepo.countBySchool_IdAndStatus(schoolId, StudentLifecycleStatus.INACTIVE))
                .transferredCount(studentRepo.countBySchool_IdAndStatus(schoolId, StudentLifecycleStatus.TRANSFERRED))
                .alumniCount(studentRepo.countBySchool_IdAndStatus(schoolId, StudentLifecycleStatus.ALUMNI))
                .build();
    }

    @Transactional
    public StudentProfileSummaryDTO getProfile(Integer studentId) {
        Integer schoolId = requireSchoolId();
        StudentCallerContext ctx = accessGuard.resolve(schoolId);
        requireCanAccessStudent(ctx, studentId, schoolId);
        Student s = studentRepo
                .findByIdAndSchool_Id(studentId, schoolId)
                .orElseThrow(() -> new IllegalArgumentException("Student not found."));
        return buildAndRedactProfile(s, ctx);
    }

    @Transactional
    public StudentProfileSummaryDTO onboard(StudentOnboardingCreateDTO dto) {
        Integer schoolId = requireSchoolId();
        StudentCallerContext ctx = accessGuard.resolve(schoolId);
        if (!ctx.canCreateStudents()) {
            throw new AccessDeniedException("You do not have permission to create student records.");
        }
        School school = schoolRepo.findById(schoolId).orElseThrow();

        validateGuardianPayload(dto.getGuardians());

        if (studentRepo.findBySchool_IdAndAdmissionNo(schoolId, dto.getCore().getAdmissionNo().trim()).isPresent()) {
            throw new IllegalArgumentException("Admission number already exists for this school.");
        }

        Student s = new Student();
        s.setSchool(school);
        mapCoreCreate(s, dto.getCore());
        s.setStatus(StudentLifecycleStatus.ACTIVE);
        s = studentRepo.save(s);

        // Create default document checklist rows
        ensureDefaultDocumentsExist(s);

        AcademicYear year = resolveAcademicYear(schoolId, dto.getEnrollment().getAcademicYearId());
        ClassGroup cg =
                classGroupRepo.findByIdAndSchool_Id(dto.getEnrollment().getClassGroupId(), schoolId).orElseThrow();

        String roll = blankToNull(dto.getEnrollment().getRollNo());
        if (roll != null
                && enrollmentRepo.existsByAcademicYear_IdAndClassGroup_IdAndRollNo(year.getId(), cg.getId(), roll)) {
            throw new IllegalArgumentException("Roll number already used in this class for the academic year.");
        }

        StudentAcademicEnrollment en = new StudentAcademicEnrollment();
        en.setStudent(s);
        en.setAcademicYear(year);
        en.setClassGroup(cg);
        en.setRollNo(roll);
        en.setAdmissionDate(defaultDateOrToday(dto.getEnrollment().getAdmissionDate()));
        en.setJoiningDate(defaultDateOrToday(dto.getEnrollment().getJoiningDate()));
        en.setStatus(StudentAcademicEnrollmentStatus.ACTIVE);
        en.setAdmissionCategory(dto.getEnrollment().getAdmissionCategory());

        enrollmentRepo.save(en);

        s.setClassGroup(cg);
        studentRepo.save(s);

        persistMedicalIfPresent(s, dto.getMedical());

        for (GuardianLinkPayloadDTO gDto : dto.getGuardians()) {
            persistGuardianLink(school, s, gDto);
        }

        return buildProfile(studentRepo.findByIdAndSchool_Id(s.getId(), schoolId).orElseThrow());
    }

    @Transactional
    public StudentProfileSummaryDTO updateProfile(Integer studentId, StudentUpdateDTO dto) {
        Integer schoolId = requireSchoolId();
        StudentCallerContext ctx = accessGuard.resolve(schoolId);
        if (!ctx.canEdit()) throw new AccessDeniedException("You do not have permission to edit student profiles.");
        Student s = studentRepo.findByIdAndSchool_Id(studentId, schoolId).orElseThrow();

        s.setFirstName(dto.getFirstName().trim());
        s.setMiddleName(blankToNull(dto.getMiddleName()));
        s.setLastName(blankToNull(dto.getLastName()));
        s.setDateOfBirth(dto.getDateOfBirth());
        s.setGender(blankToNull(dto.getGender()));
        s.setBloodGroup(blankToNull(dto.getBloodGroup()));
        if (dto.getPhotoUrl() != null && !dto.getPhotoUrl().isBlank()) {
            s.setPhotoUrl(dto.getPhotoUrl().trim());
        } else {
            s.setPhotoUrl(null);
        }
        s.setPhone(blankToNull(dto.getPhone()));
        s.setAddress(blankToNull(dto.getAddress()));

        if (dto.getStatus() != null) {
            if (dto.getStatus() == StudentLifecycleStatus.ACTIVE) {
                boolean hasActiveEnrollment = enrollmentRepo
                        .findByStudent_IdOrderByAcademicYearStartsOnDesc(s.getId())
                        .stream()
                        .anyMatch(e -> e.getStatus() == StudentAcademicEnrollmentStatus.ACTIVE);
                if (!hasActiveEnrollment) {
                    throw new IllegalArgumentException(
                            "Cannot mark ACTIVE without at least one active academic enrollment.");
                }
            }
            s.setStatus(dto.getStatus());
        }

        studentRepo.save(s);
        return buildProfile(s);
    }

    @Transactional
    public StudentProfileSummaryDTO upsertMedical(Integer studentId, StudentMedicalUpsertPayload dto) {
        Integer schoolId = requireSchoolId();
        StudentCallerContext ctx = accessGuard.resolve(schoolId);
        if (!ctx.canViewMedical()) {
            throw new AccessDeniedException("You do not have permission to update medical information.");
        }
        Student s = studentRepo.findByIdAndSchool_Id(studentId, schoolId).orElseThrow();
        StudentMedicalInfo m = medicalRepo.findByStudent_Id(studentId).orElseGet(() -> {
            StudentMedicalInfo fresh = new StudentMedicalInfo();
            fresh.setStudent(s);
            return fresh;
        });
        m.setAllergies(blankToNull(dto.getAllergies()));
        m.setMedicalConditions(blankToNull(dto.getMedicalConditions()));
        m.setEmergencyContactName(blankToNull(dto.getEmergencyContactName()));
        m.setEmergencyContactPhone(blankToNull(dto.getEmergencyContactPhone()));
        m.setDoctorContact(blankToNull(dto.getDoctorContact()));
        m.setMedicationNotes(blankToNull(dto.getMedicationNotes()));
        medicalRepo.save(m);
        return buildProfile(s);
    }

    @Transactional
    public StudentProfileSummaryDTO updateGuardian(Integer studentId, Integer guardianId, GuardianUpdateDTO dto) {
        Integer schoolId = requireSchoolId();
        StudentCallerContext ctx = accessGuard.resolve(schoolId);
        if (!ctx.canEdit()) throw new AccessDeniedException("You do not have permission to edit guardian details.");
        Student s = studentRepo.findByIdAndSchool_Id(studentId, schoolId).orElseThrow();
        Guardian g = guardianRepo.findById(guardianId)
                .filter(gu -> gu.getSchool().getId().equals(schoolId))
                .orElseThrow(() -> new IllegalArgumentException("Guardian not found."));
        StudentGuardian link = studentGuardianRepo.findByStudent_IdOrderByPrimaryGuardianDescIdAsc(studentId)
                .stream().filter(sg -> sg.getGuardian().getId().equals(guardianId))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Guardian not linked to student."));

        g.setName(dto.getName().trim());
        g.setPhone(dto.getPhone().trim());
        g.setEmail(blankToNull(dto.getEmail()));
        g.setOccupation(blankToNull(dto.getOccupation()));
        guardianRepo.save(g);

        link.setRelation(dto.getRelation().trim());
        link.setReceivesNotifications(dto.isReceivesNotifications());
        link.setCanLogin(dto.isCanLogin());
        studentGuardianRepo.save(link);

        return buildProfile(s);
    }

    @Transactional
    public StudentProfileSummaryDTO setPrimaryGuardian(Integer studentId, Integer guardianId) {
        Integer schoolId = requireSchoolId();
        StudentCallerContext ctx = accessGuard.resolve(schoolId);
        if (!ctx.canEdit()) throw new AccessDeniedException("You do not have permission to set primary guardian.");
        Student s = studentRepo.findByIdAndSchool_Id(studentId, schoolId).orElseThrow();
        List<StudentGuardian> links = studentGuardianRepo
                .findByStudent_IdOrderByPrimaryGuardianDescIdAsc(studentId);
        boolean found = false;
        for (StudentGuardian link : links) {
            boolean isTarget = link.getGuardian().getId().equals(guardianId);
            link.setPrimaryGuardian(isTarget);
            if (isTarget) found = true;
        }
        if (!found) throw new IllegalArgumentException("Guardian not linked to student.");
        studentGuardianRepo.saveAll(links);
        return buildProfile(s);
    }

    @Transactional
    public StudentProfileSummaryDTO transferSection(Integer studentId, SectionTransferDTO dto) {
        Integer schoolId = requireSchoolId();
        StudentCallerContext ctx = accessGuard.resolve(schoolId);
        if (!ctx.canTransfer()) throw new AccessDeniedException("You do not have permission to transfer students.");
        Student s = studentRepo.findByIdAndSchool_Id(studentId, schoolId).orElseThrow();
        AcademicYear year = academicYearRepo.findByIdAndSchool_Id(dto.getAcademicYearId(), schoolId)
                .orElseThrow(() -> new IllegalArgumentException("Academic year not found."));
        ClassGroup newCg = classGroupRepo.findByIdAndSchool_Id(dto.getNewClassGroupId(), schoolId)
                .orElseThrow(() -> new IllegalArgumentException("Target class-section not found."));

        String roll = blankToNull(dto.getRollNo());
        if (roll != null && enrollmentRepo.existsByAcademicYear_IdAndClassGroup_IdAndRollNo(
                year.getId(), newCg.getId(), roll)) {
            throw new IllegalArgumentException(
                    "Roll number " + roll + " is already taken in the target class for this academic year.");
        }

        StudentAcademicEnrollment active = enrollmentRepo
                .findFirstByStudent_IdAndAcademicYear_Id(studentId, year.getId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "No enrollment found for this student in the selected academic year."));
        if (active.getStatus() != StudentAcademicEnrollmentStatus.ACTIVE) {
            throw new IllegalArgumentException(
                    "Enrollment is not ACTIVE; cannot transfer.");
        }
        if (active.getClassGroup().getId().equals(newCg.getId())) {
            throw new IllegalArgumentException("Student is already in the selected class-section.");
        }

        active.setClassGroup(newCg);
        if (roll != null) active.setRollNo(roll);
        if (dto.getEffectiveDate() != null) active.setJoiningDate(dto.getEffectiveDate());
        enrollmentRepo.save(active);

        // Sync denormalised reference on student
        s.setClassGroup(newCg);
        studentRepo.save(s);

        return buildProfile(s);
    }

    private void persistGuardianLink(School school, Student student, GuardianLinkPayloadDTO gDto) {
        Guardian g = new Guardian();
        g.setSchool(school);
        g.setName(gDto.getName().trim());
        g.setPhone(gDto.getPhone().trim());
        g.setEmail(blankToNull(gDto.getEmail()));
        g.setOccupation(blankToNull(gDto.getOccupation()));
        g.setAddressLine1(blankToNull(gDto.getAddressLine1()));
        g.setAddressLine2(blankToNull(gDto.getAddressLine2()));
        g.setCity(blankToNull(gDto.getCity()));
        g.setState(blankToNull(gDto.getState()));
        g.setPincode(blankToNull(gDto.getPincode()));
        guardianRepo.save(g);

        StudentGuardian link = new StudentGuardian();
        link.setStudent(student);
        link.setGuardian(g);
        link.setRelation(gDto.getRelation().trim());
        link.setPrimaryGuardian(gDto.isPrimaryGuardian());
        link.setCanLogin(gDto.isCanLogin());
        link.setReceivesNotifications(gDto.isReceivesNotifications());
        studentGuardianRepo.save(link);
    }

    private void validateGuardianPayload(List<GuardianLinkPayloadDTO> guardians) {
        if (guardians == null || guardians.isEmpty()) {
            throw new IllegalArgumentException("At least one guardian is required.");
        }
        long primaries = guardians.stream().filter(GuardianLinkPayloadDTO::isPrimaryGuardian).count();
        if (primaries != 1) {
            throw new IllegalArgumentException("Exactly one primary guardian is required.");
        }
    }

    private AcademicYear resolveAcademicYear(Integer schoolId, Integer requestedYearId) {
        if (requestedYearId != null) {
            return academicYearRepo
                    .findByIdAndSchool_Id(requestedYearId, schoolId)
                    .orElseThrow(() -> new IllegalArgumentException("Unknown academic year for this school."));
        }
        return academicYearRepo
                .findFirstBySchool_Id(schoolId, Sort.by(Sort.Direction.DESC, "startsOn", "id"))
                .orElseGet(() -> createRollingAcademicYear(schoolId));
    }

    private AcademicYear createRollingAcademicYear(Integer schoolId) {
        School school = schoolRepo.findById(schoolId).orElseThrow();
        LocalDate today = LocalDate.now();
        int startY = today.getMonthValue() >= 4 ? today.getYear() : today.getYear() - 1;
        int endY = startY + 1;
        AcademicYear ay = new AcademicYear();
        ay.setSchool(school);
        ay.setLabel(startY + "-" + endY);
        ay.setStartsOn(LocalDate.of(startY, 4, 1));
        ay.setEndsOn(LocalDate.of(endY, 3, 31));
        return academicYearRepo.save(ay);
    }

    private static LocalDate defaultDateOrToday(LocalDate d) {
        return d != null ? d : LocalDate.now();
    }

    private static String blankToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private void mapCoreCreate(Student s, StudentCoreCreateDTO core) {
        s.setAdmissionNo(core.getAdmissionNo().trim());
        s.setFirstName(core.getFirstName().trim());
        s.setMiddleName(blankToNull(core.getMiddleName()));
        s.setLastName(blankToNull(core.getLastName()));
        s.setDateOfBirth(core.getDateOfBirth());
        s.setGender(blankToNull(core.getGender()));
        s.setBloodGroup(blankToNull(core.getBloodGroup()));
        if (core.getPhotoUrl() != null && !core.getPhotoUrl().isBlank()) {
            s.setPhotoUrl(core.getPhotoUrl().trim());
        }
        String formattedAddress = formatResidentialAddress(core);
        if (formattedAddress != null && !formattedAddress.isBlank()) {
            s.setAddress(
                    formattedAddress.length() > 256 ? formattedAddress.substring(0, 256) : formattedAddress);
        }
    }

    private static String formatResidentialAddress(StudentCoreCreateDTO core) {
        if (core == null) return null;
        StringBuilder sb = new StringBuilder();
        appendAddrLine(sb, blankToNull(core.getAddressLine1()));
        appendAddrLine(sb, blankToNull(core.getAddressLine2()));
        String locality = localityLine(core.getCity(), core.getState(), core.getPincode());
        appendAddrLine(sb, blankToNull(locality));
        return sb.length() == 0 ? null : sb.toString();
    }

    private static void appendAddrLine(StringBuilder sb, String line) {
        if (line == null || line.isBlank()) return;
        if (!sb.isEmpty()) sb.append('\n');
        sb.append(line.trim());
    }

    private static String localityLine(String cityRaw, String stateRaw, String pinRaw) {
        String city = blankToNull(cityRaw);
        String state = blankToNull(stateRaw);
        String pin = blankToNull(pinRaw);
        if (city == null && state == null && pin == null) return null;
        StringBuilder sb = new StringBuilder();
        if (city != null) sb.append(city);
        if (state != null) {
            if (!sb.isEmpty()) sb.append(", ");
            sb.append(state);
        }
        if (pin != null) {
            if (!sb.isEmpty()) sb.append(' ');
            sb.append(pin);
        }
        return sb.toString();
    }

    private boolean medicalPayloadEmpty(StudentMedicalUpsertPayload dto) {
        if (dto == null) return true;
        return blankToNull(dto.getAllergies()) == null
                && blankToNull(dto.getMedicalConditions()) == null
                && blankToNull(dto.getEmergencyContactName()) == null
                && blankToNull(dto.getEmergencyContactPhone()) == null
                && blankToNull(dto.getDoctorContact()) == null
                && blankToNull(dto.getMedicationNotes()) == null;
    }

    private void persistMedicalIfPresent(Student student, StudentMedicalUpsertPayload dto) {
        if (dto == null || medicalPayloadEmpty(dto)) return;
        StudentMedicalInfo m = new StudentMedicalInfo();
        m.setStudent(student);
        m.setAllergies(blankToNull(dto.getAllergies()));
        m.setMedicalConditions(blankToNull(dto.getMedicalConditions()));
        m.setEmergencyContactName(blankToNull(dto.getEmergencyContactName()));
        m.setEmergencyContactPhone(blankToNull(dto.getEmergencyContactPhone()));
        m.setDoctorContact(blankToNull(dto.getDoctorContact()));
        m.setMedicationNotes(blankToNull(dto.getMedicationNotes()));
        medicalRepo.save(m);
    }

    private StudentViewDTO toListViewBase(Student s) {
        StudentViewDTO dto = new StudentViewDTO();
        dto.setId(s.getId());
        dto.setAdmissionNo(s.getAdmissionNo());
        dto.setFirstName(s.getFirstName());
        dto.setMiddleName(s.getMiddleName());
        dto.setLastName(s.getLastName());
        dto.setDateOfBirth(s.getDateOfBirth());
        dto.setGender(s.getGender());
        dto.setBloodGroup(s.getBloodGroup());
        dto.setPhone(s.getPhone());
        dto.setAddress(s.getAddress());
        dto.setPhotoUrl(s.getPhotoUrl());
        dto.setStatus(s.getStatus());
        dto.setCreatedAt(s.getCreatedAt());
        dto.setUpdatedAt(s.getUpdatedAt());
        dto.setDocumentVerifiedCount(0);
        dto.setDocumentPendingCount(0);
        if (s.getClassGroup() != null) {
            ClassGroup cg = s.getClassGroup();
            dto.setClassGroupId(cg.getId());
            dto.setClassGroupCode(cg.getCode());
            dto.setClassGroupDisplayName(cg.getDisplayName());
            dto.setClassGroupGradeLevel(cg.getGradeLevel());
            dto.setClassGroupSection(cg.getSection());
        }
        return dto;
    }

    private List<StudentViewDTO> enrichListRows(List<Student> students, Integer schoolId) {
        if (students.isEmpty()) return List.of();
        List<Integer> ids =
                students.stream().map(Student::getId).distinct().toList();

        Optional<Integer> latestAyId =
                academicYearRepo
                        .findFirstBySchool_Id(schoolId, Sort.by(Sort.Direction.DESC, "startsOn", "id"))
                        .map(AcademicYear::getId);

        Map<Integer, StudentAcademicEnrollment> enrollByStudentId = new HashMap<>();
        if (latestAyId.isPresent()) {
            for (StudentAcademicEnrollment e :
                    enrollmentRepo.findEnrollmentsForStudentsInYear(ids, latestAyId.get())) {
                enrollByStudentId.merge(
                        e.getStudent().getId(),
                        e,
                        (existing, incoming) ->
                                preferEnrollmentForList(existing, incoming));
            }
        }

        Map<Integer, StudentGuardian> primaryGuardianByStudentId = new HashMap<>();
        for (StudentGuardian sg : studentGuardianRepo.findPrimaryLinksWithGuardianForStudentIds(ids)) {
            Student st = sg.getStudent();
            if (st != null) {
                primaryGuardianByStudentId.putIfAbsent(st.getId(), sg);
            }
        }

        Map<Integer, int[]> docCounts = aggregateDocumentCountsForStudents(ids);

        List<StudentViewDTO> out = new ArrayList<>();
        for (Student s : students) {
            StudentViewDTO dto = toListViewBase(s);
            StudentAcademicEnrollment en = enrollByStudentId.get(s.getId());
            if (en != null) {
                dto.setRollNo(en.getRollNo());
            }
            StudentGuardian link = primaryGuardianByStudentId.get(s.getId());
            if (link != null && link.getGuardian() != null) {
                Guardian g = link.getGuardian();
                dto.setPrimaryGuardianName(g.getName());
                dto.setPrimaryGuardianPhone(g.getPhone());
            }
            int[] vc = docCounts.getOrDefault(s.getId(), new int[] {0, 0});
            dto.setDocumentVerifiedCount(vc[0]);
            dto.setDocumentPendingCount(vc[1]);
            out.add(dto);
        }
        return out;
    }

    private static StudentAcademicEnrollment preferEnrollmentForList(
            StudentAcademicEnrollment a, StudentAcademicEnrollment b) {
        if (a.getStatus() == StudentAcademicEnrollmentStatus.ACTIVE
                && b.getStatus() != StudentAcademicEnrollmentStatus.ACTIVE) {
            return a;
        }
        if (b.getStatus() == StudentAcademicEnrollmentStatus.ACTIVE
                && a.getStatus() != StudentAcademicEnrollmentStatus.ACTIVE) {
            return b;
        }
        return b.getId() > a.getId() ? b : a;
    }

    private Map<Integer, int[]> aggregateDocumentCountsForStudents(List<Integer> ids) {
        if (ids.isEmpty()) return Map.of();
        List<StudentDocument> docs = documentRepo.findByStudent_IdIn(new HashSet<>(ids));
        Map<Integer, int[]> byStudent = new HashMap<>();
        for (StudentDocument d : docs) {
            Student st = d.getStudent();
            if (st == null) continue;
            int sid = st.getId();
            int[] counts = byStudent.computeIfAbsent(sid, k -> new int[] {0, 0});
            // counts[0] = verified, counts[1] = pending/other
            // Use new verificationStatus field; fall back to legacy status for backward compat
            boolean isVerified = false;
            if (d.getVerificationStatus() != null) {
                isVerified = d.getVerificationStatus() == StudentDocumentVerificationStatus.VERIFIED;
            } else if (d.getStatus() != null) {
                isVerified = d.getStatus() == StudentDocumentStatus.VERIFIED;
            }
            // Skip NOT_REQUIRED documents from counts entirely
            if (d.getCollectionStatus() == StudentDocumentCollectionStatus.NOT_REQUIRED) {
                continue;
            }
            if (isVerified) {
                counts[0]++;
            } else {
                counts[1]++;
            }
        }
        return byStudent;
    }

    /**
     * Ensures document checklist rows exist for a student using the school's configured requirements.
     * Falls back to the 6 default document types when no school configuration is present.
     * This method handles its own transaction for writes.
     */
    @Transactional
    public void ensureDefaultDocumentsExistForStudent(Integer studentId) {
        Student student = studentRepo.findById(studentId).orElse(null);
        if (student == null) return;
        ensureDefaultDocumentsExist(student);
    }

    /**
     * Internal helper: creates missing student_document rows from school requirements config.
     * Caller must be inside a transaction.
     */
    private void ensureDefaultDocumentsExist(Student student) {
        Integer schoolId = student.getSchool().getId();

        Set<String> existingCodes = documentRepo.findByStudent_IdOrderByCreatedAtDesc(student.getId())
                .stream()
                .map(StudentDocument::getDocumentType)
                .collect(Collectors.toSet());

        // Resolve which document types to create for this student
        List<DocumentType> typesToCreate = resolveRequiredDocumentTypes(schoolId);

        for (DocumentType dt : typesToCreate) {
            if (!existingCodes.contains(dt.getCode())) {
                StudentDocument doc = new StudentDocument();
                doc.setStudent(student);
                doc.setDocumentType(dt.getCode());
                doc.setDocumentTypeId(dt.getId());
                doc.setCollectionStatus(StudentDocumentCollectionStatus.PENDING_COLLECTION);
                doc.setUploadStatus(StudentDocumentUploadStatus.NOT_UPLOADED);
                doc.setVerificationStatus(StudentDocumentVerificationStatus.NOT_VERIFIED);
                doc.setStatus(null);
                doc.setVerifiedByStaffId(null);
                doc.setVerifiedAt(null);
                doc.setRemarks(null);
                documentRepo.save(doc);
            }
        }
    }

    /**
     * Returns the ordered list of DocumentType objects that should form the checklist for a student.
     * If the school has configured requirements, those are used; otherwise falls back to DEFAULT_DOCUMENT_CODES.
     */
    private List<DocumentType> resolveRequiredDocumentTypes(Integer schoolId) {
        // Load active, non-NOT_REQUIRED requirements from school config
        List<SchoolDocumentRequirement> reqs = requirementRepo
                .findActiveChecklistRequirements(schoolId, DocumentTargetType.STUDENT,
                        DocumentRequirementStatus.NOT_REQUIRED);

        if (!reqs.isEmpty()) {
            return reqs.stream()
                    .map(SchoolDocumentRequirement::getDocumentType)
                    .toList();
        }

        // Fall back to default codes — look up from document_types master table
        List<DocumentType> defaults = new ArrayList<>();
        for (String code : DEFAULT_DOCUMENT_CODES) {
            documentTypeRepo.findByCodeAndTargetType(code, DocumentTargetType.STUDENT)
                    .ifPresent(defaults::add);
        }
        if (!defaults.isEmpty()) {
            return defaults;
        }

        // Last resort: synthetic DocumentType objects in case the seed hasn't run yet
        return DEFAULT_DOCUMENT_CODES.stream()
                .map(code -> {
                    DocumentType dt = new DocumentType();
                    dt.setCode(code);
                    dt.setName(code.replace('_', ' '));
                    dt.setTargetType(DocumentTargetType.STUDENT);
                    return dt;
                })
                .toList();
    }

    /**
     * Collect a physical document for a student.
     * Sets collectionStatus=COLLECTED_PHYSICAL.
     */
    @Transactional
    public StudentDocumentSummaryDTO collectDocument(Integer studentId, Integer docId, String remarks) {
        Integer schoolId = requireSchoolId();
        StudentCallerContext ctx = accessGuard.resolve(schoolId);
        if (!ctx.canEdit()) {
            throw new AccessDeniedException("You do not have permission to update student documents.");
        }

        Student student = studentRepo.findByIdAndSchool_Id(studentId, schoolId)
                .orElseThrow(() -> new IllegalArgumentException("Student not found."));

        StudentDocument doc = documentRepo.findById(docId)
                .filter(d -> d.getStudent().getId().equals(student.getId()))
                .orElseThrow(() -> new IllegalArgumentException("Document not found for this student."));

        doc.setCollectionStatus(StudentDocumentCollectionStatus.COLLECTED_PHYSICAL);
        if (remarks != null && !remarks.isBlank()) {
            doc.setRemarks(remarks.trim());
        }
        documentRepo.save(doc);

        return toDocumentSummaryDTO(doc);
    }

    /**
     * Mark a document collection as pending.
     * Sets collectionStatus=PENDING_COLLECTION.
     */
    @Transactional
    public StudentDocumentSummaryDTO markDocumentPending(Integer studentId, Integer docId) {
        Integer schoolId = requireSchoolId();
        StudentCallerContext ctx = accessGuard.resolve(schoolId);
        if (!ctx.canEdit()) {
            throw new AccessDeniedException("You do not have permission to update student documents.");
        }

        Student student = studentRepo.findByIdAndSchool_Id(studentId, schoolId)
                .orElseThrow(() -> new IllegalArgumentException("Student not found."));

        StudentDocument doc = documentRepo.findById(docId)
                .filter(d -> d.getStudent().getId().equals(student.getId()))
                .orElseThrow(() -> new IllegalArgumentException("Document not found for this student."));

        doc.setCollectionStatus(StudentDocumentCollectionStatus.PENDING_COLLECTION);
        // Resetting to pending clears verification state; preserve fileUrl & uploadStatus if file exists
        doc.setVerificationStatus(StudentDocumentVerificationStatus.NOT_VERIFIED);
        doc.setVerifiedAt(null);
        doc.setVerifiedByStaffId(null);
        documentRepo.save(doc);

        return toDocumentSummaryDTO(doc);
    }

    /**
     * Mark a document as not required.
     * Sets collectionStatus=NOT_REQUIRED.
     */
    @Transactional
    public StudentDocumentSummaryDTO markDocumentNotRequired(Integer studentId, Integer docId) {
        Integer schoolId = requireSchoolId();
        StudentCallerContext ctx = accessGuard.resolve(schoolId);
        if (!ctx.canEdit()) {
            throw new AccessDeniedException("You do not have permission to update student documents.");
        }

        Student student = studentRepo.findByIdAndSchool_Id(studentId, schoolId)
                .orElseThrow(() -> new IllegalArgumentException("Student not found."));

        StudentDocument doc = documentRepo.findById(docId)
                .filter(d -> d.getStudent().getId().equals(student.getId()))
                .orElseThrow(() -> new IllegalArgumentException("Document not found for this student."));

        doc.setCollectionStatus(StudentDocumentCollectionStatus.NOT_REQUIRED);
        doc.setUploadStatus(StudentDocumentUploadStatus.NOT_UPLOADED);
        doc.setVerificationStatus(StudentDocumentVerificationStatus.NOT_VERIFIED);
        doc.setVerifiedAt(null);
        doc.setVerifiedByStaffId(null);
        documentRepo.save(doc);

        return toDocumentSummaryDTO(doc);
    }

    /**
     * Verify a document.
     * Sets verificationStatus=VERIFIED, verifiedAt timestamp, and verifiedByStaffId when available.
     * Supports both physical verification (no upload needed) and uploaded-copy verification.
     *
     * @param verificationSource explicit source; if null, inferred from upload/collection state.
     */
    @Transactional
    public StudentDocumentSummaryDTO verifyDocument(Integer studentId, Integer docId,
                                                    String remarks,
                                                    com.myhaimi.sms.entity.enums.VerificationSource verificationSource) {
        Integer schoolId = requireSchoolId();
        StudentCallerContext ctx = accessGuard.resolve(schoolId);
        if (!ctx.canEdit()) {
            throw new AccessDeniedException("You do not have permission to verify student documents.");
        }

        Student student = studentRepo.findByIdAndSchool_Id(studentId, schoolId)
                .orElseThrow(() -> new IllegalArgumentException("Student not found."));

        StudentDocument doc = documentRepo.findById(docId)
                .filter(d -> d.getStudent().getId().equals(student.getId()))
                .orElseThrow(() -> new IllegalArgumentException("Document not found for this student."));

        if (doc.getCollectionStatus() == StudentDocumentCollectionStatus.NOT_REQUIRED) {
            throw new IllegalArgumentException("Cannot verify a document that is marked as not required.");
        }

        boolean physicallyCollected = doc.getCollectionStatus() == StudentDocumentCollectionStatus.COLLECTED_PHYSICAL;
        boolean uploaded            = doc.getUploadStatus()     == StudentDocumentUploadStatus.UPLOADED;
        if (!physicallyCollected && !uploaded) {
            throw new IllegalArgumentException("Document must be collected or uploaded before verification.");
        }

        // Infer verification source if not explicitly provided
        com.myhaimi.sms.entity.enums.VerificationSource resolvedSource = verificationSource;
        if (resolvedSource == null) {
            resolvedSource = uploaded
                    ? com.myhaimi.sms.entity.enums.VerificationSource.UPLOADED_COPY
                    : com.myhaimi.sms.entity.enums.VerificationSource.PHYSICAL_ORIGINAL;
        }

        doc.setVerificationStatus(StudentDocumentVerificationStatus.VERIFIED);
        doc.setVerificationSource(resolvedSource);
        doc.setVerifiedAt(Instant.now());
        // Capture who verified the document (staff member linked to the current user)
        if (ctx.linkedStaffId() != null) {
            doc.setVerifiedByStaffId(ctx.linkedStaffId());
        }
        if (remarks != null && !remarks.isBlank()) {
            doc.setRemarks(remarks.trim());
        }
        documentRepo.save(doc);

        return toDocumentSummaryDTO(doc);
    }

    /**
     * Reject a document.
     * Sets verificationStatus=REJECTED and captures remarks (required).
     */
    @Transactional
    public StudentDocumentSummaryDTO rejectDocument(Integer studentId, Integer docId, String remarks) {
        Integer schoolId = requireSchoolId();
        StudentCallerContext ctx = accessGuard.resolve(schoolId);
        if (!ctx.canEdit()) {
            throw new AccessDeniedException("You do not have permission to reject student documents.");
        }

        if (remarks == null || remarks.isBlank()) {
            throw new IllegalArgumentException("Rejection remarks are required.");
        }

        Student student = studentRepo.findByIdAndSchool_Id(studentId, schoolId)
                .orElseThrow(() -> new IllegalArgumentException("Student not found."));

        StudentDocument doc = documentRepo.findById(docId)
                .filter(d -> d.getStudent().getId().equals(student.getId()))
                .orElseThrow(() -> new IllegalArgumentException("Document not found for this student."));

        doc.setVerificationStatus(StudentDocumentVerificationStatus.REJECTED);
        doc.setVerifiedAt(Instant.now());
        if (ctx.linkedStaffId() != null) {
            doc.setVerifiedByStaffId(ctx.linkedStaffId());
        }
        doc.setRemarks(remarks.trim());
        documentRepo.save(doc);

        return toDocumentSummaryDTO(doc);
    }

    /**
     * Update document fields (PATCH operation).
     * Allows partial updates to collection status, upload status, verification status, and remarks.
     */
    @Transactional
    public StudentDocumentSummaryDTO updateDocument(Integer studentId, Integer docId, StudentDocumentUpdateDTO dto) {
        Integer schoolId = requireSchoolId();
        StudentCallerContext ctx = accessGuard.resolve(schoolId);
        if (!ctx.canEdit()) {
            throw new AccessDeniedException("You do not have permission to update student documents.");
        }

        Student student = studentRepo.findByIdAndSchool_Id(studentId, schoolId)
                .orElseThrow(() -> new IllegalArgumentException("Student not found."));

        StudentDocument doc = documentRepo.findById(docId)
                .filter(d -> d.getStudent().getId().equals(student.getId()))
                .orElseThrow(() -> new IllegalArgumentException("Document not found for this student."));

        if (dto.getCollectionStatus() != null) {
            doc.setCollectionStatus(dto.getCollectionStatus());
        }
        if (dto.getUploadStatus() != null) {
            doc.setUploadStatus(dto.getUploadStatus());
        }
        if (dto.getVerificationStatus() != null) {
            doc.setVerificationStatus(dto.getVerificationStatus());
            // Auto-set verifiedAt when status changes to VERIFIED
            if (dto.getVerificationStatus() == StudentDocumentVerificationStatus.VERIFIED && doc.getVerifiedAt() == null) {
                doc.setVerifiedAt(Instant.now());
            }
        }
        if (dto.getRemarks() != null) {
            doc.setRemarks(dto.getRemarks().isBlank() ? null : dto.getRemarks().trim());
        }

        documentRepo.save(doc);
        return toDocumentSummaryDTO(doc);
    }

    /**
     * Derives a single display status string from the three lifecycle fields.
     * Precedence: VERIFIED > REJECTED > UPLOADED > COLLECTED_PHYSICAL > NOT_REQUIRED > PENDING_COLLECTION.
     */
    /**
     * Derives a single display status string from the three lifecycle fields.
     * Precedence: NOT_REQUIRED > REJECTED > VERIFIED > UPLOADED > COLLECTED_PHYSICAL > PENDING_COLLECTION.
     * NOT_REQUIRED wins first so a waived document never shows as verified/rejected.
     */
    static String computeDisplayStatus(StudentDocument doc) {
        StudentDocumentCollectionStatus cs = doc.getCollectionStatus();
        if (cs == StudentDocumentCollectionStatus.NOT_REQUIRED) return "NOT_REQUIRED";
        StudentDocumentVerificationStatus vs = doc.getVerificationStatus();
        if (vs == StudentDocumentVerificationStatus.REJECTED)   return "REJECTED";
        if (vs == StudentDocumentVerificationStatus.VERIFIED)   return "VERIFIED";
        StudentDocumentUploadStatus us = doc.getUploadStatus();
        if (us == StudentDocumentUploadStatus.UPLOADED)         return "UPLOADED";
        if (cs == StudentDocumentCollectionStatus.COLLECTED_PHYSICAL) return "COLLECTED_PHYSICAL";
        return "PENDING_COLLECTION";
    }

    /**
     * Convert StudentDocument entity to DTO.
     * Must be called within an active transaction (lazy-loads fileObject if fileId is set).
     */
    private StudentDocumentSummaryDTO toDocumentSummaryDTO(StudentDocument doc) {
        StudentDocumentSummaryDTO dto = new StudentDocumentSummaryDTO();
        dto.setId(doc.getId());
        dto.setDocumentType(doc.getDocumentType());

        // Populate human-readable name from the master DocumentType if available
        DocumentType dtRef = doc.getDocumentTypeRef();
        if (dtRef != null) {
            dto.setDocumentTypeName(dtRef.getName());
        }

        dto.setFileUrl(doc.getFileUrl());
        dto.setFileId(doc.getFileId());
        dto.setCollectionStatus(doc.getCollectionStatus());
        dto.setUploadStatus(doc.getUploadStatus());
        dto.setVerificationStatus(doc.getVerificationStatus());
        dto.setVerificationSource(doc.getVerificationSource());
        dto.setDisplayStatus(computeDisplayStatus(doc));
        dto.setStatus(doc.getStatus());
        dto.setVerifiedByStaffId(doc.getVerifiedByStaffId());
        dto.setVerifiedAt(doc.getVerifiedAt());
        dto.setRemarks(doc.getRemarks());
        dto.setCreatedAt(doc.getCreatedAt());

        // Populate file metadata from the linked FileObject (lazy-loaded)
        FileObject fo = doc.getFileObject();
        if (fo != null) {
            dto.setOriginalFilename(fo.getOriginalFilename());
            dto.setFileSize(fo.getFileSize());
            dto.setContentType(fo.getContentType());
            dto.setUploadedAt(fo.getUploadedAt());
        }

        return dto;
    }

    private StudentProfileSummaryDTO buildProfile(Student s) {
        // Ensure default document checklist rows exist before building profile
        ensureDefaultDocumentsExist(s);

        StudentProfileSummaryDTO out = new StudentProfileSummaryDTO();
        out.setId(s.getId());
        out.setAdmissionNo(s.getAdmissionNo());
        out.setFirstName(s.getFirstName());
        out.setMiddleName(s.getMiddleName());
        out.setLastName(s.getLastName());
        out.setDateOfBirth(s.getDateOfBirth());
        out.setGender(s.getGender());
        out.setBloodGroup(s.getBloodGroup());
        out.setPhotoUrl(s.getPhotoUrl());
        out.setProfilePhotoFileId(s.getProfilePhotoFileId());
        out.setStatus(s.getStatus());
        out.setPhone(s.getPhone());
        out.setAddress(s.getAddress());
        out.setCreatedAt(s.getCreatedAt());
        out.setUpdatedAt(s.getUpdatedAt());
        if (s.getClassGroup() != null) {
            out.setClassGroupId(s.getClassGroup().getId());
            out.setClassGroupDisplayName(s.getClassGroup().getDisplayName());
        }

        List<StudentAcademicEnrollment> ens = enrollmentRepo.findByStudent_IdOrderByAcademicYearStartsOnDesc(s.getId());
        List<StudentEnrollmentSummaryDTO> history = new ArrayList<>();
        for (StudentAcademicEnrollment e : ens) {
            history.add(toEnrollmentSummary(e));
        }
        out.setEnrollmentHistory(history);
        out.setCurrentEnrollment(pickCurrentEnrollment(ens));

        List<GuardianSummaryDTO> gRows = new ArrayList<>();
        for (StudentGuardian sg : studentGuardianRepo.findByStudent_IdOrderByPrimaryGuardianDescIdAsc(s.getId())) {
            Guardian g = sg.getGuardian();
            GuardianSummaryDTO gd = new GuardianSummaryDTO();
            gd.setId(g.getId());
            gd.setName(g.getName());
            gd.setPhone(g.getPhone());
            gd.setEmail(g.getEmail());
            gd.setRelation(sg.getRelation());
            gd.setPrimaryGuardian(sg.isPrimaryGuardian());
            gd.setCanLogin(sg.isCanLogin());
            gd.setReceivesNotifications(sg.isReceivesNotifications());
            // Populate login status
            userRepo.findFirstByLinkedGuardian_Id(g.getId()).ifPresentOrElse(
                    u -> {
                        gd.setParentUserId(u.getId());
                        gd.setLoginStatus(GuardianLoginStatus.ACTIVE);
                    },
                    () -> gd.setLoginStatus(GuardianLoginStatus.NOT_CREATED)
            );
            gRows.add(gd);
        }
        out.setGuardians(gRows);

        medicalRepo
                .findByStudent_Id(s.getId())
                .ifPresent(m -> {
                    StudentMedicalSummaryDTO md = new StudentMedicalSummaryDTO();
                    md.setAllergies(m.getAllergies());
                    md.setMedicalConditions(m.getMedicalConditions());
                    md.setEmergencyContactName(m.getEmergencyContactName());
                    md.setEmergencyContactPhone(m.getEmergencyContactPhone());
                    md.setDoctorContact(m.getDoctorContact());
                    md.setMedicationNotes(m.getMedicationNotes());
                    out.setMedical(md);
                });

        List<StudentDocumentSummaryDTO> docs = new ArrayList<>();
        for (StudentDocument d : documentRepo.findByStudent_IdOrderByCreatedAtDesc(s.getId())) {
            docs.add(toDocumentSummaryDTO(d));
        }
        out.setDocuments(docs);

        // Populate student login info — always present so the frontend can decide what to show
        userRepo.findFirstByLinkedStudent_Id(s.getId()).ifPresentOrElse(
                u -> {
                    out.setStudentUserId(u.getId());
                    out.setStudentLoginUsername(u.getUsername());
                    out.setStudentLoginStatus("ACTIVE");
                    out.setStudentLoginLastInviteSentAt(null);
                },
                () -> out.setStudentLoginStatus("NOT_CREATED")
        );

        return out;
    }

    /**
     * Builds the full profile then redacts fields the caller cannot see
     * and appends the viewer-permission flags.
     */
    private StudentProfileSummaryDTO buildAndRedactProfile(Student s, StudentCallerContext ctx) {
        StudentProfileSummaryDTO profile = buildProfile(s);
        if (!ctx.canViewGuardians()) profile.setGuardians(null);
        if (!ctx.canViewMedical())   profile.setMedical(null);
        if (!ctx.canViewDocuments()) profile.setDocuments(null);
        profile.setViewerPermissions(StudentAccessGuard.toPermissionsDTO(ctx));
        return profile;
    }

    /**
     * Throws {@link AccessDeniedException} if the current caller cannot view the given student.
     */
    private void requireCanAccessStudent(StudentCallerContext ctx, Integer studentId, Integer schoolId) {
        if (ctx.canViewAnyStudent()) return;

        if (ctx.isParent()) {
            if (ctx.linkedGuardianId() == null)
                throw new AccessDeniedException("No linked guardian for this parent account.");
            studentGuardianRepo.findByStudent_IdAndGuardian_Id(studentId, ctx.linkedGuardianId())
                    .orElseThrow(() -> new AccessDeniedException("Access denied: student is not linked to your account."));
            return;
        }

        if (ctx.isStudent()) {
            if (!studentId.equals(ctx.linkedStudentId()))
                throw new AccessDeniedException("Access denied: you can only view your own profile.");
            return;
        }

        // Class teacher / subject teacher: check student is in an allowed class group
        Set<Integer> allowed = ctx.allowedClassGroupIds();
        if (allowed != null) {
            Student s = studentRepo.findByIdAndSchool_Id(studentId, schoolId)
                    .orElseThrow(() -> new IllegalArgumentException("Student not found."));
            if (s.getClassGroup() == null || !allowed.contains(s.getClassGroup().getId()))
                throw new AccessDeniedException("Access denied: student is not in your assigned class.");
            return;
        }

        throw new AccessDeniedException("Access denied.");
    }

    private static StudentEnrollmentSummaryDTO pickCurrentEnrollment(List<StudentAcademicEnrollment> ens) {
        if (ens.isEmpty()) return null;
        for (StudentAcademicEnrollment e : ens) {
            if (e.getStatus() == StudentAcademicEnrollmentStatus.ACTIVE) {
                return toEnrollmentSummary(e);
            }
        }
        return toEnrollmentSummary(ens.getFirst());
    }

    private static StudentEnrollmentSummaryDTO toEnrollmentSummary(StudentAcademicEnrollment e) {
        StudentEnrollmentSummaryDTO d = new StudentEnrollmentSummaryDTO();
        d.setId(e.getId());
        d.setRollNo(e.getRollNo());
        d.setAdmissionDate(e.getAdmissionDate());
        d.setJoiningDate(e.getJoiningDate());
        d.setStatus(e.getStatus());
        AcademicYear ay = e.getAcademicYear();
        if (ay != null) {
            d.setAcademicYearId(ay.getId());
            d.setAcademicYearLabel(ay.getLabel());
        }
        ClassGroup cg = e.getClassGroup();
        if (cg != null) {
            d.setClassGroupId(cg.getId());
            d.setClassGroupDisplayName(cg.getDisplayName());
        }
        return d;
    }

    @Transactional
    public void linkStandaloneGuardian(GuardianStandaloneCreateDTO dto) {
        Integer schoolId = requireSchoolId();
        School school = schoolRepo.findById(schoolId).orElseThrow();
        Student student = studentRepo.findByIdAndSchool_Id(dto.getStudentId(), schoolId).orElseThrow();

        List<StudentGuardian> existing =
                studentGuardianRepo.findByStudent_IdOrderByPrimaryGuardianDescIdAsc(student.getId());
        boolean hadPrimary = existing.stream().anyMatch(StudentGuardian::isPrimaryGuardian);
        if (existing.isEmpty() && !dto.isPrimaryGuardian()) {
            throw new IllegalArgumentException("The first guardian for a learner must be primary.");
        }
        if (!existing.isEmpty() && !dto.isPrimaryGuardian() && !hadPrimary) {
            throw new IllegalArgumentException("Exactly one primary guardian is required.");
        }

        if (dto.isPrimaryGuardian()) {
            existing.forEach(x -> x.setPrimaryGuardian(false));
            studentGuardianRepo.saveAll(existing);
        }

        Guardian g = new Guardian();
        g.setSchool(school);
        g.setName(dto.getName().trim());
        g.setPhone(dto.getPhone().trim());
        g.setEmail(blankToNull(dto.getEmail()));
        g.setOccupation(blankToNull(dto.getOccupation()));
        guardianRepo.save(g);

        StudentGuardian link = new StudentGuardian();
        link.setStudent(student);
        link.setGuardian(g);
        link.setRelation(dto.getRelation().trim());
        link.setPrimaryGuardian(dto.isPrimaryGuardian());
        link.setCanLogin(dto.isCanLogin());
        link.setReceivesNotifications(dto.isReceivesNotifications());
        studentGuardianRepo.save(link);
        studentGuardianRepo.flush();

        long primaries =
                studentGuardianRepo.findByStudent_IdOrderByPrimaryGuardianDescIdAsc(student.getId()).stream()
                        .filter(StudentGuardian::isPrimaryGuardian)
                        .count();
        if (primaries != 1) {
            throw new IllegalStateException("Exactly one primary guardian is required.");
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // File integration — student document upload
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Upload a file and attach it to the given student document checklist row.
     * Sets {@code uploadStatus = UPLOADED} and links the resulting {@link com.myhaimi.sms.entity.FileObject}.
     * POST /api/students/{studentId}/documents/{docId}/upload
     */
    @Transactional
    public StudentDocumentSummaryDTO uploadDocumentFile(
            Integer studentId, Integer docId,
            MultipartFile file, Authentication auth) {

        Integer schoolId = requireSchoolId();
        StudentCallerContext ctx = accessGuard.resolve(schoolId);

        // Upload is restricted to school leadership roles only
        if (!ctx.isSchoolAdmin() && !ctx.isPrincipal() && !ctx.isVicePrincipal()) {
            throw new AccessDeniedException(
                    "You do not have permission to upload student documents. " +
                    "Only School Admin, Principal, or Vice Principal may upload.");
        }

        Student student = studentRepo.findByIdAndSchool_Id(studentId, schoolId)
                .orElseThrow(() -> new IllegalArgumentException("Student not found."));

        StudentDocument doc = documentRepo.findById(docId)
                .filter(d -> d.getStudent().getId().equals(student.getId()))
                .orElseThrow(() -> new IllegalArgumentException("Document not found for this student."));

        Integer uploadedBy = resolveUserId(auth);

        // FileService validates type (PDF/JPG/PNG) and size (≤ 10 MB) for STUDENT_DOCUMENT
        // Visibility is PRIVATE — official student documents are sensitive
        FileObjectDTO fo = fileService.uploadForModule(
                file,
                FileCategory.STUDENT_DOCUMENT,
                "STUDENT",
                studentId.toString(),
                FileVisibility.PRIVATE,
                uploadedBy);

        // Link the FileObject — never store the raw signed URL
        doc.setFileId(fo.getId());

        // Upgrade collection status if the document was waiting to be collected
        if (doc.getCollectionStatus() == StudentDocumentCollectionStatus.PENDING_COLLECTION) {
            doc.setCollectionStatus(StudentDocumentCollectionStatus.COLLECTED_PHYSICAL);
        }

        // A newly uploaded file always resets verification to NOT_VERIFIED
        doc.setVerificationStatus(StudentDocumentVerificationStatus.NOT_VERIFIED);
        doc.setUploadStatus(StudentDocumentUploadStatus.UPLOADED);

        documentRepo.save(doc);

        return toDocumentSummaryDTO(doc);
    }


    // ═══════════════════════════════════════════════════════════════════════════
    // File integration — student profile photo upload
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Upload a profile photo for a student and store only the FileObject id.
     * The frontend must call GET /api/files/{profilePhotoFileId}/download-url
     * to obtain a short-lived signed URL for display — never use the download-url
     * endpoint directly as an img src (it returns JSON, not image bytes).
     *
     * POST /api/students/{studentId}/profile-photo
     */
    @Transactional
    public StudentProfileSummaryDTO uploadProfilePhoto(
            Integer studentId, MultipartFile file, Authentication auth) {

        Integer schoolId = requireSchoolId();
        StudentCallerContext ctx = accessGuard.resolve(schoolId);

        // Leadership roles can update student profile photos
        if (!ctx.canEdit()) {
            throw new AccessDeniedException(
                    "You do not have permission to upload a student profile photo.");
        }

        Student student = studentRepo.findByIdAndSchool_Id(studentId, schoolId)
                .orElseThrow(() -> new IllegalArgumentException("Student not found."));

        Integer uploadedBy = resolveUserId(auth);

        // FileService enforces: jpeg/png/webp only, max 2 MB
        FileObjectDTO fo = fileService.uploadForModule(
                file,
                FileCategory.PROFILE_PHOTO,
                "STUDENT",
                studentId.toString(),
                FileVisibility.STUDENT_VISIBLE,
                uploadedBy);

        // Store only the FileObject id — never set photoUrl to a /download-url path
        student.setProfilePhotoFileId(fo.getId());
        studentRepo.save(student);

        return buildProfile(student);
    }

    // ── helper: resolve userId from authentication ────────────────────────────

    private Integer resolveUserId(Authentication auth) {
        if (auth == null) return null;
        return userRepo.findFirstByEmailIgnoreCase(auth.getName())
                .map(u -> u.getId())
                .orElse(null);
    }
}
