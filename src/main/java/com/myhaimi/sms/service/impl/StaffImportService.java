package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.staff.importdto.*;
import com.myhaimi.sms.entity.*;
import com.myhaimi.sms.entity.enums.*;
import com.myhaimi.sms.repository.*;
import com.myhaimi.sms.security.RoleNames;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Orchestrates parse → validate → preview → commit for bulk staff import.
 *
 * <p>Preview runs read-only. Commit is intentionally NOT @Transactional at the
 * service level — each row runs in its own nested transaction via
 * {@link StaffRowPersistService} for fault isolation.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StaffImportService {

    // ── CSV template columns (case-insensitive normalised keys) ────────────────
    private static final List<String> REQUIRED_COLUMNS = List.of(
            "fullname", "phone", "stafftype", "designation"
    );

    private static final List<String> VALID_STAFF_TYPES = List.of(
            "TEACHING", "NON_TEACHING", "ADMIN", "SUPPORT"
    );

    private static final List<String> VALID_EMPLOYMENT_TYPES = List.of(
            "FULL_TIME", "PART_TIME", "CONTRACT", "VISITING"
    );

    private static final String TEMP_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    private static final SecureRandom RNG = new SecureRandom();

    private final StaffImportTokenStore tokenStore;
    private final StaffRepo             staffRepo;
    private final SchoolRepo            schoolRepo;
    private final SubjectRepo           subjectRepo;
    private final RoleRepo              roleRepo;
    private final UserRepo              userRepo;
    private final StaffTeachableSubjectRepository teachableSubjectRepo;
    private final StaffRoleMappingRepository      staffRoleMappingRepository;
    private final PasswordEncoder       passwordEncoder;

    // ── Preview ───────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public StaffImportPreviewDto preview(MultipartFile file) throws IOException {
        Integer schoolId = requireSchoolId();

        // 1. Parse CSV
        List<StaffImportRowDto> rows;
        try {
            rows = parseCsv(file.getInputStream());
        } catch (CsvParseException ex) {
            throw new IllegalArgumentException(ex.getMessage());
        }
        if (rows.isEmpty())
            throw new IllegalArgumentException("CSV contains no data rows (only a header was found).");

        // 2. Pre-load catalogues (avoids N+1)
        Set<String> existingEmpNos  = loadExistingEmpNos(schoolId);      // active only → true duplicate
        Set<String> deletedEmpNos   = loadDeletedEmpNos(schoolId);       // soft-deleted → resurrection
        Set<String> existingEmails  = loadExistingEmails(schoolId);
        Map<String, Integer> subjectCodeToId = loadSubjectCodeMap(schoolId);

        // 3. Track duplicates within the CSV itself
        Set<String> seenEmpNos  = new LinkedHashSet<>();
        Set<String> seenEmails  = new LinkedHashSet<>();

        List<StaffImportRowResultDto> results = new ArrayList<>(rows.size());
        List<StaffImportRowDto>       validRows = new ArrayList<>();

        for (StaffImportRowDto row : rows) {
            List<String> errors   = new ArrayList<>();
            List<String> warnings = new ArrayList<>();
            boolean      isDuplicate = false;

            // ── fullName ─────────────────────────────────────────────────────
            if (blank(row.getFullName()))
                errors.add("Row " + row.getRowNumber() + ": fullName is required.");

            // ── phone ────────────────────────────────────────────────────────
            String phone = normalise(row.getPhone());
            if (phone == null) {
                errors.add("Row " + row.getRowNumber() + ": phone is required.");
            } else {
                String digits = phone.replaceAll("[^0-9]", "");
                if (digits.length() < 10 || digits.length() > 15)
                    errors.add("Row " + row.getRowNumber() + ": phone '" + phone + "' must contain 10–15 digits.");
            }

            // ── staffType ────────────────────────────────────────────────────
            String staffType = normalise(row.getStaffType());
            if (staffType == null) {
                errors.add("Row " + row.getRowNumber() + ": staffType is required.");
            } else {
                staffType = staffType.toUpperCase(Locale.ROOT).replace(' ', '_');
                if (!VALID_STAFF_TYPES.contains(staffType))
                    errors.add("Row " + row.getRowNumber() + ": staffType '" + staffType + "' is invalid. Use: " + String.join(", ", VALID_STAFF_TYPES));
                else row.setStaffType(staffType);
            }

            // ── designation ──────────────────────────────────────────────────
            if (blank(row.getDesignation()))
                errors.add("Row " + row.getRowNumber() + ": designation is required.");

            // ── roles ────────────────────────────────────────────────────────
            String rolesRaw = normalise(row.getRoles());
            if (rolesRaw == null) {
                errors.add("Row " + row.getRowNumber() + ": roles is required (e.g. TEACHER or SCHOOL_ADMIN).");
            } else {
                List<String> roleList = Arrays.stream(rolesRaw.split(","))
                        .map(String::trim).map(r -> r.toUpperCase(Locale.ROOT))
                        .filter(r -> !r.isEmpty()).toList();
                List<String> badRoles = roleList.stream()
                        .filter(r -> RoleNames.SUPER_ADMIN.equals(r) || RoleNames.STUDENT.equals(r) || RoleNames.PARENT.equals(r))
                        .toList();
                if (!badRoles.isEmpty())
                    errors.add("Row " + row.getRowNumber() + ": Roles not permitted: " + String.join(", ", badRoles));
            }

            // ── employeeNo uniqueness ────────────────────────────────────────
            String empNo = normalise(row.getEmployeeNo());
            if (empNo != null) {
                if (!seenEmpNos.add(empNo.toLowerCase())) {
                    errors.add("Row " + row.getRowNumber() + ": employeeNo '" + empNo + "' appears more than once in this CSV.");
                } else if (existingEmpNos.contains(empNo.toLowerCase())) {
                    isDuplicate = true;  // active staff with this empNo → skip
                } else if (deletedEmpNos.contains(empNo.toLowerCase())) {
                    warnings.add("Row " + row.getRowNumber() + ": Staff with employeeNo '" + empNo + "' was previously deleted and will be re-imported.");
                }
            }

            // ── email uniqueness ─────────────────────────────────────────────
            String email = normalise(row.getEmail());
            if (email != null) {
                if (!seenEmails.add(email.toLowerCase())) {
                    errors.add("Row " + row.getRowNumber() + ": email '" + email + "' appears more than once in this CSV.");
                } else if (existingEmails.contains(email.toLowerCase())) {
                    // If only email collides (not empNo), it means link-not-duplicate
                    // Still warn — HR can link manually via access tab
                    warnings.add("Row " + row.getRowNumber() + ": email '" + email + "' already exists for another user. If createLoginAccount=true, the existing user will be linked instead of creating a duplicate.");
                }
            }

            // ── dateOfBirth (optional) ───────────────────────────────────────
            String dobRaw = normalise(row.getDateOfBirth());
            if (dobRaw != null) {
                try {
                    LocalDate dob = LocalDate.parse(dobRaw);
                    if (dob.isAfter(LocalDate.now()))
                        errors.add("Row " + row.getRowNumber() + ": dateOfBirth cannot be a future date.");
                } catch (DateTimeParseException e) {
                    errors.add("Row " + row.getRowNumber() + ": dateOfBirth '" + dobRaw + "' is not a valid date (use yyyy-MM-dd).");
                }
            }

            // ── joiningDate (optional) ───────────────────────────────────────
            String joinRaw = normalise(row.getJoiningDate());
            if (joinRaw != null) {
                try { LocalDate.parse(joinRaw); }
                catch (DateTimeParseException e) {
                    errors.add("Row " + row.getRowNumber() + ": joiningDate '" + joinRaw + "' is not a valid date (use yyyy-MM-dd).");
                }
            }

            // ── employmentType (optional) ────────────────────────────────────
            String empType = normalise(row.getEmploymentType());
            if (empType != null) {
                empType = empType.toUpperCase(Locale.ROOT).replace(' ', '_');
                if (!VALID_EMPLOYMENT_TYPES.contains(empType))
                    errors.add("Row " + row.getRowNumber() + ": employmentType '" + empType + "' is invalid. Use: " + String.join(", ", VALID_EMPLOYMENT_TYPES));
                else row.setEmploymentType(empType);
            }

            // ── subjectCodes resolution ───────────────────────────────────��──
            String subjectCodesRaw = normalise(row.getSubjectCodes());
            if (subjectCodesRaw != null) {
                List<String> codes = Arrays.stream(subjectCodesRaw.split(","))
                        .map(String::trim).filter(s -> !s.isEmpty()).toList();
                List<String> unknown = new ArrayList<>();
                List<Integer> resolvedIds = new ArrayList<>();
                for (String code : codes) {
                    Integer id = subjectCodeToId.get(code.toUpperCase(Locale.ROOT));
                    if (id == null) unknown.add(code);
                    else resolvedIds.add(id);
                }
                if (!unknown.isEmpty())
                    errors.add("Row " + row.getRowNumber() + ": Unknown subject code(s): " + String.join(", ", unknown) + ". Must match codes configured for this school.");
                else row.setResolvedSubjectIds(resolvedIds);
            }

            // ── TEACHER without subjects — warning only ──────────────────────
            String rolesVal = normalise(row.getRoles());
            if (rolesVal != null && errors.isEmpty()) {
                boolean isTeacher = Arrays.stream(rolesVal.split(","))
                        .map(String::trim)
                        .anyMatch(r -> RoleNames.TEACHER.equalsIgnoreCase(r));
                if (isTeacher && row.getResolvedSubjectIds().isEmpty())
                    warnings.add("Row " + row.getRowNumber() + ": TEACHER role assigned but no subject codes provided — this staff member will not be timetable eligible.");
            }

            // ── maxWeeklyLectureLoad (optional integer) ──────────────────────
            String maxLoad = normalise(row.getMaxWeeklyLectureLoad());
            if (maxLoad != null) {
                try {
                    int v = Integer.parseInt(maxLoad);
                    if (v < 1 || v > 100) errors.add("Row " + row.getRowNumber() + ": maxWeeklyLectureLoad must be between 1 and 100.");
                } catch (NumberFormatException e) {
                    errors.add("Row " + row.getRowNumber() + ": maxWeeklyLectureLoad '" + maxLoad + "' must be an integer.");
                }
            }

            // ── Classify row ─────────────────────────────────────────────────
            if (isDuplicate && errors.isEmpty()) {
                results.add(StaffImportRowResultDto.duplicate(row,
                        "Row " + row.getRowNumber() + ": Staff with employeeNo '" + empNo + "' already exists in this school."));
            } else if (!errors.isEmpty()) {
                results.add(StaffImportRowResultDto.invalid(row, errors));
            } else if (!warnings.isEmpty()) {
                StaffImportRowResultDto r = StaffImportRowResultDto.warn(row, warnings);
                results.add(r);
                validRows.add(row);
            } else {
                results.add(StaffImportRowResultDto.valid(row));
                validRows.add(row);
            }
        }

        // 4. Store and respond
        String token = tokenStore.store(schoolId, validRows);

        long warnCount  = results.stream().filter(r -> r.getStatus() == StaffImportRowResultDto.RowStatus.WARN).count();
        long invalidCnt = results.stream().filter(r -> r.getStatus() == StaffImportRowResultDto.RowStatus.INVALID).count();
        long dupCnt     = results.stream().filter(r -> r.getStatus() == StaffImportRowResultDto.RowStatus.DUPLICATE).count();

        return StaffImportPreviewDto.builder()
                .importToken(token)
                .totalRows(rows.size())
                .validRows(validRows.size())
                .warnRows((int) warnCount)
                .invalidRows((int) invalidCnt)
                .duplicateRows((int) dupCnt)
                .rows(results)
                .build();
    }

    // ── Commit ────────────────────────────────────────────────────────────────

    public StaffImportCommitResultDto commit(StaffImportCommitDto request) {
        Integer schoolId = requireSchoolId();

        List<StaffImportRowDto> validRows = tokenStore.consume(request.getImportToken(), schoolId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Import token is invalid or has expired. Please re-upload the CSV file."));

        if (validRows.isEmpty())
            return StaffImportCommitResultDto.builder().importedCount(0).skippedCount(0).failedRows(List.of()).build();

        School school = schoolRepo.findById(schoolId).orElseThrow();
        List<StaffImportRowResultDto> failedRows = new ArrayList<>();
        int imported = 0;

        for (StaffImportRowDto row : validRows) {
            try {
                persistRow(school, row, schoolId);
                imported++;
            } catch (Exception ex) {
                log.warn("Staff import commit: row {} failed — {}", row.getRowNumber(), ex.getMessage());
                if (request.isStrictMode())
                    throw new IllegalStateException("Row " + row.getRowNumber() + " failed: " + ex.getMessage(), ex);
                failedRows.add(StaffImportRowResultDto.invalid(row, List.of("Row " + row.getRowNumber() + ": " + ex.getMessage())));
            }
        }

        return StaffImportCommitResultDto.builder()
                .importedCount(imported)
                .skippedCount(failedRows.size())
                .failedRows(failedRows)
                .build();
    }

    public void discard(String token) { tokenStore.discard(token); }

    // ── Row persistence ───────────────────────────────────────────────────────

    @Transactional
    void persistRow(School school, StaffImportRowDto row, Integer schoolId) {
        Integer schoolId2 = school.getId();

        // ── 1. Resolve or resurrect Staff ──────────────────────────────────────
        String empNo = normalise(row.getEmployeeNo());
        String email = normalise(row.getEmail());
        if (email != null) email = email.toLowerCase(Locale.ROOT);

        // Auto-generate employeeNo if absent — keep trying until we find one with
        // no collision (active OR soft-deleted rows share the same unique constraint).
        if (empNo == null || empNo.isBlank()) {
            long n = staffRepo.countBySchool_Id(schoolId2);
            String candidate;
            do {
                n++;
                candidate = "EMP-" + String.format("%04d", n);
            } while (staffRepo.findFirstBySchool_IdAndEmployeeNoIgnoreCase(schoolId2, candidate).isPresent());
            empNo = candidate;
        }

        // Try to find an existing (possibly soft-deleted) staff row to resurrect
        // so we never violate the unique(school_id, employee_no) constraint.
        Staff staff = null;
        if (email != null) {
            staff = staffRepo.findFirstBySchool_IdAndEmailIgnoreCase(schoolId2, email).orElse(null);
        }
        if (staff == null) {
            staff = staffRepo.findFirstBySchool_IdAndEmployeeNoIgnoreCase(schoolId2, empNo).orElse(null);
        }

        final boolean isResurrection = staff != null;
        if (isResurrection) {
            staff.setDeleted(false);
        } else {
            staff = new Staff();
            staff.setSchool(school);
            staff.setEmployeeNo(empNo);
            staff.setCreatedBy("bulk-import");
        }

        staff.setFullName(row.getFullName().trim());
        staff.setPhone(row.getPhone() != null ? row.getPhone().trim() : null);
        staff.setEmail(email);
        if (row.getGender() != null) staff.setGender(row.getGender().trim());
        if (normalise(row.getDateOfBirth()) != null)
            staff.setDateOfBirth(LocalDate.parse(row.getDateOfBirth().trim()));

        // Employment
        staff.setStaffType(StaffType.valueOf(Optional.ofNullable(normalise(row.getStaffType())).orElse("TEACHING")));
        staff.setStatus(StaffStatus.DRAFT);
        staff.setDesignation(row.getDesignation() != null ? row.getDesignation().trim() : null);
        if (normalise(row.getDepartment()) != null) staff.setDepartment(row.getDepartment().trim());
        if (normalise(row.getJoiningDate()) != null) staff.setJoiningDate(LocalDate.parse(row.getJoiningDate().trim()));
        if (normalise(row.getEmploymentType()) != null) staff.setEmploymentType(EmploymentType.valueOf(row.getEmploymentType()));

        // Timetable preferences
        String maxLoad = normalise(row.getMaxWeeklyLectureLoad());
        if (maxLoad != null) staff.setMaxWeeklyLectureLoad(Integer.parseInt(maxLoad));

        String cbt = normalise(row.getCanBeClassTeacher());
        if (cbt != null) staff.setCanBeClassTeacher(parseBool(cbt, true));

        String cts = normalise(row.getCanTakeSubstitution());
        if (cts != null) staff.setCanTakeSubstitution(parseBool(cts, true));

        // Address
        if (normalise(row.getAddressLine1()) != null) staff.setCurrentAddressLine1(row.getAddressLine1().trim());
        if (normalise(row.getCity())         != null) staff.setCity(row.getCity().trim());
        if (normalise(row.getState())        != null) staff.setState(row.getState().trim());
        if (normalise(row.getPincode())      != null) staff.setPincode(row.getPincode().trim());

        // Emergency contact
        if (normalise(row.getEmergencyContactName())  != null) staff.setEmergencyContactName(row.getEmergencyContactName().trim());
        if (normalise(row.getEmergencyContactPhone()) != null) staff.setEmergencyContactPhone(row.getEmergencyContactPhone().trim());

        // Qualifications
        if (normalise(row.getHighestQualification())       != null) staff.setHighestQualification(row.getHighestQualification().trim());
        if (normalise(row.getProfessionalQualification())  != null) staff.setProfessionalQualification(row.getProfessionalQualification().trim());

        staff.setUpdatedBy("bulk-import");
        final Staff savedStaff = staffRepo.save(staff);

        // ── 2. Roles ────────────────────────────────────────────────────────
        String rolesRaw = normalise(row.getRoles());
        Set<Role> roleEntities = new HashSet<>();
        if (rolesRaw != null) {
            // Support both pipe-separated (ENG001|ENG002) and comma-separated
            String[] roleParts = rolesRaw.contains("|") ? rolesRaw.split("\\|") : rolesRaw.split(",");
            for (String rName : roleParts) {
                String up = rName.trim().toUpperCase(Locale.ROOT);
                if (!up.isEmpty()) {
                    roleRepo.findByName(up).stream().findFirst().ifPresent(roleEntities::add);
                }
            }
        }

        // Create StaffRoleMapping records — these are the authoritative source for staff roles
        // (User.roles is for login auth; StaffRoleMapping drives the ERP role display).
        // Use entity-level deleteAll (carries its own @Transactional) to avoid needing an
        // outer transaction — persistRow() is called via this.persistRow() (same-class), so
        // Spring's AOP proxy cannot honour the @Transactional on this method.
        List<StaffRoleMapping> oldMappings = staffRoleMappingRepository.findByStaff_Id(savedStaff.getId());
        if (!oldMappings.isEmpty()) staffRoleMappingRepository.deleteAll(oldMappings);
        for (Role r : roleEntities) {
            staffRoleMappingRepository.save(new StaffRoleMapping(savedStaff, r));
        }

        // ── 3. Teachable subjects ────────────────────────────────────────────
        // Clear existing teachable subjects first (safe for resurrections).
        // Same reason: entity-level deleteAll avoids the @Modifying transaction requirement.
        List<StaffTeachableSubject> oldTeachable = teachableSubjectRepo.findByStaff_Id(savedStaff.getId());
        if (!oldTeachable.isEmpty()) teachableSubjectRepo.deleteAll(oldTeachable);
        if (!row.getResolvedSubjectIds().isEmpty()) {
            for (Integer subId : row.getResolvedSubjectIds()) {
                subjectRepo.findById(subId).ifPresent(subject -> {
                    StaffTeachableSubject ts = new StaffTeachableSubject();
                    ts.setStaff(savedStaff);
                    ts.setSubject(subject);
                    teachableSubjectRepo.save(ts);
                });
            }
        }

        // ── 4. Login account ─────────────────────────────────────────────────
        String createLoginRaw = normalise(row.getCreateLoginAccount());
        boolean createLogin   = parseBool(createLoginRaw, false);

        if (createLogin && email != null && !email.isBlank()) {
            User existingByEmail = userRepo.findFirstByEmailIgnoreCase(email).orElse(null);
            if (existingByEmail != null) {
                // Link the existing user — no duplicate
                existingByEmail.setLinkedStaff(savedStaff);
                existingByEmail.setSchool(school);
                existingByEmail.setEnabled(true);
                if (!roleEntities.isEmpty()) existingByEmail.setRoles(roleEntities);
                userRepo.save(existingByEmail);
            } else {
                String tempPwd  = generateTempPassword();
                String username = deriveUniqueUsername(email);
                User user = new User();
                user.setEmail(email);
                user.setUsername(username);
                user.setPassword(passwordEncoder.encode(tempPwd));
                user.setEnabled(true);
                user.setSchool(school);
                user.setLinkedStaff(savedStaff);
                user.setRoles(roleEntities);
                userRepo.save(user);
                // Note: temp password is not returned on import (too many rows)
                // Admin should use reset-password from the profile page.
                log.info("Staff import: created login for {} (userId will be set)", email);
            }
        } else if (!roleEntities.isEmpty()) {
            // Update roles on any existing login without creating a new one
            userRepo.findFirstBySchool_IdAndLinkedStaff_Id(schoolId2, savedStaff.getId()).ifPresent(u -> {
                u.setRoles(roleEntities);
                userRepo.save(u);
            });
        }
    }

    // ── CSV parsing ───────────────────────────────────────────────────────────

    private List<StaffImportRowDto> parseCsv(InputStream input) throws IOException {
        BufferedReader reader = new BufferedReader(
                new InputStreamReader(stripBom(input), StandardCharsets.UTF_8));

        String headerLine = reader.readLine();
        if (headerLine == null || headerLine.isBlank())
            throw new CsvParseException("CSV file is empty or has no header row.");

        List<String> headers = splitCsvLine(headerLine);
        Map<String, Integer> colIndex = buildColIndex(headers);
        validateRequiredCols(colIndex, headers);

        List<StaffImportRowDto> rows = new ArrayList<>();
        String line;
        int rowNum = 0;
        while ((line = reader.readLine()) != null) {
            if (line.isBlank()) continue;
            rowNum++;
            rows.add(buildRow(rowNum, splitCsvLine(line), colIndex));
        }
        return rows;
    }

    private StaffImportRowDto buildRow(int rowNum, List<String> fields, Map<String, Integer> idx) {
        StaffImportRowDto row = new StaffImportRowDto();
        row.setRowNumber(rowNum);
        row.setEmployeeNo(get(fields, idx, "employeeno"));
        row.setFullName(get(fields, idx, "fullname"));
        row.setPhone(get(fields, idx, "phone"));
        row.setEmail(get(fields, idx, "email"));
        row.setGender(get(fields, idx, "gender"));
        row.setDateOfBirth(get(fields, idx, "dateofbirth"));
        row.setStaffType(get(fields, idx, "stafftype"));
        row.setDesignation(get(fields, idx, "designation"));
        row.setDepartment(get(fields, idx, "department"));
        row.setJoiningDate(get(fields, idx, "joiningdate"));
        row.setEmploymentType(get(fields, idx, "employmenttype"));
        row.setRoles(get(fields, idx, "roles"));
        // Accept both "subjectcodes" and "subjects" as column name
        String subjectCodesVal = get(fields, idx, "subjectcodes");
        if (subjectCodesVal == null) subjectCodesVal = get(fields, idx, "subjects");
        // Normalise pipe-separator to comma so downstream split(",") works
        if (subjectCodesVal != null) subjectCodesVal = subjectCodesVal.replace('|', ',');
        row.setSubjectCodes(subjectCodesVal);
        row.setMaxWeeklyLectureLoad(get(fields, idx, "maxweeklylectureload"));
        row.setCanBeClassTeacher(get(fields, idx, "canbeclassteacher"));
        row.setCanTakeSubstitution(get(fields, idx, "cantakesubstitution"));
        row.setCreateLoginAccount(get(fields, idx, "createloginaccount"));
        // Accept both "addressline1" and "address" as column name
        String addrVal = get(fields, idx, "addressline1");
        if (addrVal == null) addrVal = get(fields, idx, "address");
        row.setAddressLine1(addrVal);
        row.setCity(get(fields, idx, "city"));
        row.setState(get(fields, idx, "state"));
        row.setPincode(get(fields, idx, "pincode"));
        row.setEmergencyContactName(get(fields, idx, "emergencycontactname"));
        row.setEmergencyContactPhone(get(fields, idx, "emergencycontactphone"));
        row.setHighestQualification(get(fields, idx, "highestqualification"));
        row.setProfessionalQualification(get(fields, idx, "professionalqualification"));
        return row;
    }

    private static String get(List<String> fields, Map<String, Integer> idx, String key) {
        Integer i = idx.get(key);
        if (i == null || i >= fields.size()) return null;
        String v = fields.get(i);
        return (v == null || v.isBlank()) ? null : v.trim();
    }

    private static Map<String, Integer> buildColIndex(List<String> headers) {
        Map<String, Integer> map = new HashMap<>();
        for (int i = 0; i < headers.size(); i++)
            map.put(headers.get(i).toLowerCase().replaceAll("\\s+", ""), i);
        return map;
    }

    private static void validateRequiredCols(Map<String, Integer> idx, List<String> headers) {
        List<String> missing = REQUIRED_COLUMNS.stream().filter(c -> !idx.containsKey(c)).toList();
        if (!missing.isEmpty())
            throw new CsvParseException("CSV is missing required column(s): " + String.join(", ", missing) + ". Found: " + headers);
    }

    private static List<String> splitCsvLine(String line) {
        List<String> result = new ArrayList<>();
        StringBuilder sb = new StringBuilder();
        boolean inQuotes = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (inQuotes) {
                if (c == '"') {
                    if (i + 1 < line.length() && line.charAt(i + 1) == '"') { sb.append('"'); i++; }
                    else inQuotes = false;
                } else sb.append(c);
            } else {
                if (c == '"') inQuotes = true;
                else if (c == ',') { result.add(sb.toString()); sb.setLength(0); }
                else sb.append(c);
            }
        }
        result.add(sb.toString());
        return result;
    }

    private static InputStream stripBom(InputStream in) throws IOException {
        InputStream buffered = in.markSupported() ? in : new java.io.BufferedInputStream(in);
        buffered.mark(3);
        byte[] bom = new byte[3];
        int read = buffered.read(bom, 0, 3);
        if (read == 3 && bom[0] == (byte)0xEF && bom[1] == (byte)0xBB && bom[2] == (byte)0xBF) return buffered;
        buffered.reset();
        return buffered;
    }

    // ── Catalogue loaders ──────────────────────────────────────────────────────

    private Set<String> loadExistingEmpNos(Integer schoolId) {
        return staffRepo.findBySchool_IdAndIsDeletedFalseOrderByEmployeeNoAsc(schoolId)
                .stream().map(s -> s.getEmployeeNo().toLowerCase()).collect(Collectors.toSet());
    }

    private Set<String> loadDeletedEmpNos(Integer schoolId) {
        return staffRepo.findBySchool_IdOrderByEmployeeNoAsc(schoolId).stream()
                .filter(Staff::isDeleted)
                .map(s -> s.getEmployeeNo().toLowerCase())
                .collect(Collectors.toSet());
    }

    private Set<String> loadExistingEmails(Integer schoolId) {
        return staffRepo.findBySchool_IdAndIsDeletedFalseOrderByEmployeeNoAsc(schoolId)
                .stream().filter(s -> s.getEmail() != null)
                .map(s -> s.getEmail().toLowerCase()).collect(Collectors.toSet());
    }

    private Map<String, Integer> loadSubjectCodeMap(Integer schoolId) {
        Map<String, Integer> map = new HashMap<>();
        subjectRepo.findBySchool_IdAndIsDeletedFalseOrderByCodeAsc(schoolId)
                .forEach(s -> map.put(s.getCode().toUpperCase(Locale.ROOT), s.getId()));
        return map;
    }

    // ── Utilities ──────────────────────────────────────────────────────────────

    private Integer requireSchoolId() {
        Integer id = TenantContext.getSchoolId();
        if (id == null) throw new IllegalStateException("Missing school context");
        return id;
    }

    private static String normalise(String s) {
        if (s == null) return null;
        s = s.trim();
        return s.isEmpty() ? null : s;
    }

    private static boolean blank(String s) { return normalise(s) == null; }

    private static boolean parseBool(String s, boolean defaultVal) {
        if (s == null) return defaultVal;
        return "true".equalsIgnoreCase(s) || "yes".equalsIgnoreCase(s) || "1".equals(s.trim());
    }

    private String generateTempPassword() {
        StringBuilder sb = new StringBuilder(12);
        for (int i = 0; i < 12; i++) sb.append(TEMP_CHARS.charAt(RNG.nextInt(TEMP_CHARS.length())));
        return sb.toString();
    }

    private String deriveUniqueUsername(String email) {
        String base = email.split("@")[0].replaceAll("[^a-zA-Z0-9._-]", "").toLowerCase(Locale.ROOT);
        String candidate = base;
        int n = 0;
        while (userRepo.findFirstByUsernameIgnoreCase(candidate).isPresent())
            candidate = base + (++n);
        return candidate;
    }

    // ── Inner exception ────────────────────────────────────────────────────────

    public static class CsvParseException extends RuntimeException {
        public CsvParseException(String msg) { super(msg); }
    }
}

