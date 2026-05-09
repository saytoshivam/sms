package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.StudentViewDTO;
import com.myhaimi.sms.DTO.student.*;
import com.myhaimi.sms.entity.*;
import com.myhaimi.sms.entity.enums.StudentAcademicEnrollmentStatus;
import com.myhaimi.sms.entity.enums.StudentDocumentStatus;
import com.myhaimi.sms.entity.enums.StudentLifecycleStatus;
import com.myhaimi.sms.repository.*;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
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
            String search) {
        Integer schoolId = requireSchoolId();
        Specification<Student> spec = Specification.where(StudentSpecs.forSchool(schoolId))
                .and(StudentSpecs.classGroup(classGroupId))
                .and(StudentSpecs.classGroupGradeLevel(gradeLevel))
                .and(StudentSpecs.classGroupSection(section))
                .and(StudentSpecs.lifecycleStatus(status))
                .and(StudentSpecs.studentListSearch(search));
        Page<Student> page = studentRepo.findAll(spec, pageable);
        List<StudentViewDTO> rows = enrichListRows(page.getContent(), schoolId);
        return new PageImpl<>(rows, page.getPageable(), page.getTotalElements());
    }

    public StudentProfileSummaryDTO getProfile(Integer studentId) {
        Integer schoolId = requireSchoolId();
        Student s = studentRepo
                .findByIdAndSchool_Id(studentId, schoolId)
                .orElseThrow(() -> new IllegalArgumentException("Student not found."));
        return buildProfile(s);
    }

    @Transactional
    public StudentProfileSummaryDTO onboard(StudentOnboardingCreateDTO dto) {
        Integer schoolId = requireSchoolId();
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
            StudentDocumentStatus stEnum = d.getStatus();
            if (stEnum == StudentDocumentStatus.VERIFIED) {
                counts[0]++;
            } else {
                counts[1]++;
            }
        }
        return byStudent;
    }

    private StudentProfileSummaryDTO buildProfile(Student s) {
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
            StudentDocumentSummaryDTO dd = new StudentDocumentSummaryDTO();
            dd.setId(d.getId());
            dd.setDocumentType(d.getDocumentType());
            dd.setFileUrl(d.getFileUrl());
            dd.setStatus(d.getStatus());
            dd.setVerifiedByStaffId(d.getVerifiedByStaffId());
            dd.setVerifiedAt(d.getVerifiedAt());
            dd.setRemarks(d.getRemarks());
            dd.setCreatedAt(d.getCreatedAt());
            docs.add(dd);
        }
        out.setDocuments(docs);
        return out;
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
}
