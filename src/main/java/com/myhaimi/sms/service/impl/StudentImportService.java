package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.student.importdto.*;
import com.myhaimi.sms.entity.*;
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
 * The preview step runs in a read-only transaction for catalogue look-ups.
 * The commit step is intentionally NOT @Transactional at this level so that
 * each row runs in its own transaction (via {@link StudentRowPersistService})
 * for fault isolation — one bad row does not roll back the others.
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
    private final StudentRowPersistService rowPersistService;

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
        Map<String, Set<String>> enrolledRollNos = new HashMap<>(); // key = "classGroupId:yearId"

        // 3. Validate each row
        Set<String> seenAdmissionNosInCsv = new LinkedHashSet<>();
        List<StudentImportRowResultDto> results = new ArrayList<>(rows.size());
        List<StudentImportRowDto> validRows = new ArrayList<>();

        for (StudentImportRowDto row : rows) {
            List<String> errors = new ArrayList<>();
            boolean isDuplicate = false;

            // ── admissionNo ──────────────────────────────────────────────────────
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

            // ── firstName ────────────────────────────────────────────────────────
            if (blankToNull(row.getFirstName()) == null) {
                errors.add("Row " + row.getRowNumber() + ": firstName is required.");
            }

            // ── dateOfBirth (optional, must be parseable if present) ─────────────
            String dobRaw = blankToNull(row.getDateOfBirth());
            if (dobRaw != null) {
                try {
                    LocalDate parsed = LocalDate.parse(dobRaw);
                    if (parsed.isAfter(LocalDate.now())) {
                        errors.add("Row " + row.getRowNumber() + ": dateOfBirth cannot be a future date.");
                    }
                } catch (DateTimeParseException e) {
                    errors.add("Row " + row.getRowNumber()
                            + ": dateOfBirth '" + dobRaw + "' is not a valid date (use yyyy-MM-dd).");
                }
            }

            // ── classCode ────────────────────────────────────────────────────────
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

            // ── academicYear ─────────────────────────────────────────────────────
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

            // ── guardian ─────────────────────────────────────────────────────────
            if (blankToNull(row.getGuardianName()) == null) {
                errors.add("Row " + row.getRowNumber() + ": guardianName is required.");
            }
            if (blankToNull(row.getGuardianPhone()) == null) {
                errors.add("Row " + row.getRowNumber() + ": guardianPhone is required.");
            }

            // ── rollNo uniqueness ─────────────────────────────────────────────────
            String rollNo = blankToNull(row.getRollNo());
            if (!isDuplicate && errors.isEmpty() && rollNo != null
                    && classGroup != null && academicYear != null) {
                final var finalClassGroup = classGroup;
                final var finalAcademicYear = academicYear;
                String key = finalClassGroup.getId() + ":" + finalAcademicYear.getId();
                Set<String> usedRollNos = enrolledRollNos.computeIfAbsent(key, k ->
                        loadUsedRollNos(finalClassGroup.getId(), finalAcademicYear.getId()));
                if (!usedRollNos.add(rollNo.toLowerCase())) {
                    errors.add("Row " + row.getRowNumber()
                            + ": rollNo '" + rollNo
                            + "' is already used in class '" + classCode
                            + "' for academic year '" + yearLabel + "'.");
                }
            }

            // ── Classify row ──────────────────────────────────────────────────────
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

    // ── Discard ──────────────────────────────────────────────────────────────────

    public void discard(String token) {
        tokenStore.discard(token);
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
                rowPersistService.persist(school, row);
                imported++;
            } catch (Exception ex) {
                log.warn("Import commit: row {} failed – {}", row.getRowNumber(), ex.getMessage());
                if (request.isStrictMode()) {
                    throw new IllegalStateException(
                            "Row " + row.getRowNumber() + " failed at commit: " + ex.getMessage(), ex);
                }
                failedRows.add(StudentImportRowResultDto.invalid(row,
                        List.of("Row " + row.getRowNumber() + ": " + friendlyMessage(ex))));
            }
        }

        return StudentImportCommitResultDto.builder()
                .importedCount(imported)
                .skippedCount(failedRows.size())
                .failedRows(failedRows)
                .build();
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

    /** Returns a lowercased set of existing admission numbers for the school. */
    private Set<String> loadExistingAdmissionNos(Integer schoolId) {
        List<Student> all = studentRepo.findBySchool_IdOrderByIdAsc(schoolId);
        Set<String> nos = new HashSet<>(all.size() * 2);
        for (Student s : all) {
            nos.add(s.getAdmissionNo().toLowerCase());
        }
        return nos;
    }

    /**
     * Returns a mutable lowercased set of roll numbers already enrolled in the
     * given class+year so the caller can track within-file duplicates.
     */
    private Set<String> loadUsedRollNos(Integer classGroupId, Integer academicYearId) {
        Set<String> dbRollNos = enrollmentRepo.findRollNosForClassAndYear(classGroupId, academicYearId);
        Set<String> result = new HashSet<>(dbRollNos.size() * 2);
        for (String rn : dbRollNos) {
            if (rn != null) result.add(rn.toLowerCase());
        }
        return result;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────────

    private static String blankToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static String friendlyMessage(Exception ex) {
        String msg = ex.getMessage();
        if (msg == null) return "Unexpected error.";
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

