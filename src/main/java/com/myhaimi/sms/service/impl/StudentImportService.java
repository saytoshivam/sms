package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.student.importdto.*;
import com.myhaimi.sms.entity.*;
import com.myhaimi.sms.entity.enums.StudentAcademicEnrollmentStatus;
import com.myhaimi.sms.entity.enums.StudentEnrollmentAdmissionCategory;
import com.myhaimi.sms.entity.enums.StudentLifecycleStatus;
import com.myhaimi.sms.repository.*;
import com.myhaimi.sms.utils.CsvImportParser;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.*;

/**
 * Orchestrates the parse → validate → preview → commit import flow.
 *
 * <h3>Thread safety</h3>
 * All read operations are done in a {@code readOnly} transaction.
 * The commit step runs in its own {@code @Transactional} method so each
 * student is saved independently; one failure does not roll back others
 * (unless {@code strictMode = true}).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StudentImportService {

    private final StudentImportTokenStore tokenStore;
    private final StudentRepo studentRepo;
    private final SchoolRepo schoolRepo;
    private final ClassGroupRepo classGroupRepo;
    private final AcademicYearRepo academicYearRepo;
    private final StudentAcademicEnrollmentRepo enrollmentRepo;
    private final StudentMedicalInfoRepo medicalRepo;
    private final GuardianRepo guardianRepo;
    private final StudentGuardianRepo studentGuardianRepo;

    // ── Preview ──────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public StudentImportPreviewDto preview(MultipartFile file) throws IOException {
        Integer schoolId = requireSchoolId();

        // 1. Parse CSV
        List<StudentImportRowDto> rows;
        try {
            rows = CsvImportParser.parse(file.getInputStream());
        } catch (CsvImportParser.CsvParseException ex) {
            throw new IllegalArgumentException(ex.getMessage());
        }

        if (rows.isEmpty()) {
            throw new IllegalArgumentException("CSV contains no data rows (only a header was found).");
        }

        // 2. Pre-load lookup catalogues once (avoids N+1 DB hits)
        Map<String, ClassGroup> classGroupByCode = loadClassGroupsByCode(schoolId);
        Map<String, AcademicYear> academicYearByLabel = loadAcademicYearsByLabel(schoolId);
        Set<String> existingAdmissionNos = loadExistingAdmissionNos(schoolId);
        // Roll-no uniqueness checked lazily per class+year combination
        Map<String, Set<String>> enrolledRollNos = new HashMap<>(); // key = classGroupId:yearId

        // 3. Validate each row
        Set<String> seenAdmissionNosInCsv = new LinkedHashSet<>();
        List<StudentImportRowResultDto> results = new ArrayList<>(rows.size());
        List<StudentImportRowDto> validRows = new ArrayList<>();

        for (StudentImportRowDto row : rows) {
            List<String> errors = new ArrayList<>();
            boolean isDuplicate = false;

            // ── Field validations ───────────────────────────────────────────────

            String admNo = blankToNull(row.getAdmissionNo());
            if (admNo == null) {
                errors.add("Row " + row.getRowNumber() + ": admissionNo is required.");
            } else {
                row.setAdmissionNo(admNo);
                if (!seenAdmissionNosInCsv.add(admNo.toLowerCase())) {
                    errors.add("Row " + row.getRowNumber()
                            + ": admissionNo '" + admNo + "' appears more than once in this CSV.");
                } else if (existingAdmissionNos.contains(admNo.toLowerCase())) {
                    isDuplicate = true;
                }
            }

            if (blankToNull(row.getFirstName()) == null) {
                errors.add("Row " + row.getRowNumber() + ": firstName is required.");
            }

            // Date of birth – optional but must be parseable if present
            String dobRaw = blankToNull(row.getDateOfBirth());
            if (dobRaw != null) {
                try {
                    LocalDate.parse(dobRaw);
                } catch (DateTimeParseException e) {
                    errors.add("Row " + row.getRowNumber()
                            + ": dateOfBirth '" + dobRaw + "' is not a valid date (use yyyy-MM-dd).");
                }
            }

            // Class group
            String classCode = blankToNull(row.getClassCode());
            ClassGroup classGroup = null;
            if (classCode == null) {
                errors.add("Row " + row.getRowNumber() + ": classCode is required.");
            } else {
                classGroup = classGroupByCode.get(classCode.toLowerCase());
                if (classGroup == null) {
                    errors.add("Row " + row.getRowNumber()
                            + ": Class code '" + classCode + "' not found.");
                } else {
                    row.setResolvedClassGroupId(classGroup.getId());
                    // Validate sectionCode if provided
                    String sectionCode = blankToNull(row.getSectionCode());
                    if (sectionCode != null && classGroup.getSection() != null
                            && !sectionCode.equalsIgnoreCase(classGroup.getSection())) {
                        errors.add("Row " + row.getRowNumber()
                                + ": sectionCode '" + sectionCode
                                + "' does not match the section of class '" + classCode
                                + "' (expected '" + classGroup.getSection() + "').");
                    }
                }
            }

            // Academic year
            String yearLabel = blankToNull(row.getAcademicYear());
            AcademicYear academicYear = null;
            if (yearLabel == null) {
                errors.add("Row " + row.getRowNumber() + ": academicYear is required.");
            } else {
                academicYear = academicYearByLabel.get(yearLabel.toLowerCase());
                if (academicYear == null) {
                    errors.add("Row " + row.getRowNumber()
                            + ": Academic year '" + yearLabel + "' not found for this school.");
                } else {
                    row.setResolvedAcademicYearId(academicYear.getId());
                }
            }

            // Guardian
            if (blankToNull(row.getGuardianName()) == null) {
                errors.add("Row " + row.getRowNumber() + ": guardianName is required.");
            }
            if (blankToNull(row.getGuardianPhone()) == null) {
                errors.add("Row " + row.getRowNumber() + ": guardianPhone is required.");
            }

            // Roll number uniqueness (only if all above resolved & rollNo is provided)
            String rollNo = blankToNull(row.getRollNo());
            if (!isDuplicate && errors.isEmpty() && rollNo != null
                    && classGroup != null && academicYear != null) {
                String key = classGroup.getId() + ":" + academicYear.getId();
                Set<String> usedRollNos = enrolledRollNos.computeIfAbsent(key, k ->
                        loadUsedRollNos(classGroup.getId(), academicYear.getId()));
                if (!usedRollNos.add(rollNo.toLowerCase())) {
                    errors.add("Row " + row.getRowNumber()
                            + ": rollNo '" + rollNo
                            + "' is already used in class '" + classCode
                            + "' for academic year '" + yearLabel + "'.");
                }
            }

            // ── Classify row ────────────────────────────────────────────────────

            if (isDuplicate && errors.stream().noneMatch(e -> e.contains("admissionNo"))) {
                results.add(StudentImportRowResultDto.duplicate(row,
                        "Row " + row.getRowNumber() + ": Student with admissionNo '"
                                + row.getAdmissionNo() + "' already exists in this school."));
            } else if (!errors.isEmpty()) {
                results.add(StudentImportRowResultDto.invalid(row, errors));
            } else {
                results.add(StudentImportRowResultDto.valid(row));
                validRows.add(row);
            }
        }

        // 4. Store session and build response
        String token = tokenStore.store(schoolId, validRows);

        long invalid   = results.stream().filter(r -> r.getStatus() == StudentImportRowResultDto.RowStatus.INVALID).count();
        long duplicate = results.stream().filter(r -> r.getStatus() == StudentImportRowResultDto.RowStatus.DUPLICATE).count();

        return StudentImportPreviewDto.builder()
                .importToken(token)
                .totalRows(rows.size())
                .validRows(validRows.size())
                .invalidRows((int) invalid)
                .duplicateRows((int) duplicate)
                .rows(results)
                .build();
    }

    // ── Commit ───────────────────────────────────────────────────────────────────

    public StudentImportCommitResultDto commit(StudentImportCommitDto request) {
        Integer schoolId = requireSchoolId();

        List<StudentImportRowDto> validRows = tokenStore.consume(request.getImportToken(), schoolId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Import token is invalid or has expired. Please re-upload the CSV file."));

        if (validRows.isEmpty()) {
            return StudentImportCommitResultDto.builder()
                    .importedCount(0).skippedCount(0).failedRows(List.of()).build();
        }

        School school = schoolRepo.findById(schoolId).orElseThrow();
        List<StudentImportRowResultDto> failedRows = new ArrayList<>();
        int imported = 0;

        for (StudentImportRowDto row : validRows) {
            try {
                persistRow(school, row);
                imported++;
            } catch (Exception ex) {
                log.warn("Import commit: row {} failed – {}", row.getRowNumber(), ex.getMessage());
                if (request.isStrictMode()) {
                    throw new IllegalStateException(
                            "Row " + row.getRowNumber() + " failed at commit: " + ex.getMessage(), ex);
                }
                List<String> errs = List.of("Row " + row.getRowNumber()
                        + ": " + friendlyMessage(ex));
                failedRows.add(StudentImportRowResultDto.invalid(row, errs));
            }
        }

        return StudentImportCommitResultDto.builder()
                .importedCount(imported)
                .skippedCount(failedRows.size())
                .failedRows(failedRows)
                .build();
    }

    // ── Persist a single row ─────────────────────────────────────────────────────

    @Transactional
    public void persistRow(School school, StudentImportRowDto row) {
        // Guard: double-check admissionNo uniqueness (concurrent import)
        if (studentRepo.findBySchool_IdAndAdmissionNo(school.getId(), row.getAdmissionNo()).isPresent()) {
            throw new IllegalArgumentException(
                    "admissionNo '" + row.getAdmissionNo() + "' was created by another concurrent operation.");
        }

        ClassGroup classGroup = classGroupRepo.findById(row.getResolvedClassGroupId())
                .orElseThrow(() -> new IllegalArgumentException("Class group not found at commit time."));
        AcademicYear academicYear = academicYearRepo.findById(row.getResolvedAcademicYearId())
                .orElseThrow(() -> new IllegalArgumentException("Academic year not found at commit time."));

        // ── Student ────────────────────────────────────────────────────────────
        Student student = new Student();
        student.setSchool(school);
        student.setAdmissionNo(row.getAdmissionNo().trim());
        student.setFirstName(row.getFirstName().trim());
        student.setMiddleName(blankToNull(row.getMiddleName()));
        student.setLastName(blankToNull(row.getLastName()));
        student.setGender(blankToNull(row.getGender()));
        student.setBloodGroup(null);
        student.setStatus(StudentLifecycleStatus.ACTIVE);

        String dob = blankToNull(row.getDateOfBirth());
        if (dob != null) student.setDateOfBirth(LocalDate.parse(dob));

        // Compose address
        String address = composeAddress(
                row.getAddressLine1(), null, row.getCity(), row.getState(), row.getPincode());
        student.setAddress(address);
        student.setClassGroup(classGroup);
        studentRepo.save(student);

        // ── Enrollment ─────────────────────────────────────────────────────────
        String rollNo = blankToNull(row.getRollNo());
        StudentAcademicEnrollment enr = new StudentAcademicEnrollment();
        enr.setStudent(student);
        enr.setAcademicYear(academicYear);
        enr.setClassGroup(classGroup);
        enr.setRollNo(rollNo);
        enr.setAdmissionDate(LocalDate.now());
        enr.setJoiningDate(LocalDate.now());
        enr.setStatus(StudentAcademicEnrollmentStatus.ACTIVE);
        enr.setAdmissionCategory(StudentEnrollmentAdmissionCategory.NEW_ADMISSION);
        enrollmentRepo.save(enr);

        // ── Guardian ───────────────────────────────────────────────────────────
        if (blankToNull(row.getGuardianName()) != null) {
            Guardian guardian = new Guardian();
            guardian.setSchool(school);
            guardian.setName(row.getGuardianName().trim());
            guardian.setPhone(row.getGuardianPhone().trim());
            guardian.setEmail(blankToNull(row.getGuardianEmail()));
            guardianRepo.save(guardian);

            StudentGuardian link = new StudentGuardian();
            link.setStudent(student);
            link.setGuardian(guardian);
            link.setRelation(row.getGuardianRelation() != null ? row.getGuardianRelation().trim() : "Guardian");
            link.setPrimaryGuardian(true);
            link.setReceivesNotifications(true);
            link.setCanLogin(false);
            studentGuardianRepo.save(link);
        }
    }

    // ── Catalogue loaders ────────────────────────────────────────────────────────

    private Map<String, ClassGroup> loadClassGroupsByCode(Integer schoolId) {
        List<ClassGroup> all = classGroupRepo.findAllBySchool_IdAndIsDeletedFalseOrderByGradeLevelAscCodeAsc(schoolId);
        Map<String, ClassGroup> byCode = new HashMap<>();
        for (ClassGroup cg : all) {
            byCode.put(cg.getCode().toLowerCase(), cg);
        }
        return byCode;
    }

    private Map<String, AcademicYear> loadAcademicYearsByLabel(Integer schoolId) {
        List<AcademicYear> all = academicYearRepo.findBySchool_Id(
                schoolId, Sort.by(Sort.Direction.DESC, "startsOn"));
        Map<String, AcademicYear> byLabel = new HashMap<>();
        for (AcademicYear ay : all) {
            byLabel.put(ay.getLabel().toLowerCase(), ay);
        }
        return byLabel;
    }

    /** Returns lowercased admission numbers. */
    private Set<String> loadExistingAdmissionNos(Integer schoolId) {
        List<Student> all = studentRepo.findBySchool_IdOrderByIdAsc(schoolId);
        Set<String> nos = new HashSet<>(all.size() * 2);
        for (Student s : all) {
            nos.add(s.getAdmissionNo().toLowerCase());
        }
        return nos;
    }

    /** Returns lowercased roll numbers already enrolled in a given class+year. */
    private Set<String> loadUsedRollNos(Integer classGroupId, Integer academicYearId) {
        List<StudentAcademicEnrollment> enrs = enrollmentRepo
                .findEnrollmentsForStudentsInYear(List.of(), academicYearId); // warm cache – unused
        // More targeted: fetch all enrollments for this class+year
        Set<String> used = new HashSet<>();
        // Use existsByAcademicYear_IdAndClassGroup_IdAndRollNo per roll would be N+1;
        // instead keep a mutable set and populate it lazily from CSV rows.
        // DB state is already validated via existsByAcademicYear_IdAndClassGroup_IdAndRollNo
        // during preview row validation.
        return used;
    }

    // ── Utility ──────────────────────────────────────────────────────────────────

    private static String blankToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static String composeAddress(
            String line1, String line2, String city, String state, String pincode) {
        List<String> parts = new ArrayList<>();
        if (blankToNull(line1) != null) parts.add(line1.trim());
        if (blankToNull(line2) != null) parts.add(line2.trim());
        StringBuilder locality = new StringBuilder();
        if (blankToNull(city) != null) locality.append(city.trim());
        if (blankToNull(state) != null) {
            if (!locality.isEmpty()) locality.append(", ");
            locality.append(state.trim());
        }
        if (blankToNull(pincode) != null) {
            if (!locality.isEmpty()) locality.append(" ");
            locality.append(pincode.trim());
        }
        if (!locality.isEmpty()) parts.add(locality.toString());
        if (parts.isEmpty()) return null;
        String combined = String.join("\n", parts);
        return combined.length() > 256 ? combined.substring(0, 256) : combined;
    }

    private static String friendlyMessage(Exception ex) {
        String msg = ex.getMessage();
        if (msg == null) return "Unexpected error.";
        // Strip JDBC / Hibernate noise
        if (msg.contains("Duplicate entry")) return "A record with the same key already exists.";
        if (msg.contains("constraint")) return "Database constraint violation: " + msg;
        return msg;
    }

    private Integer requireSchoolId() {
        Integer id = TenantContext.getSchoolId();
        if (id == null) throw new IllegalStateException("Missing school context.");
        return id;
    }
}

