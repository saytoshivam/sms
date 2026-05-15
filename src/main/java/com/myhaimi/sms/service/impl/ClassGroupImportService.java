package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.classgroup.importdto.*;
import com.myhaimi.sms.entity.ClassGroup;
import com.myhaimi.sms.entity.School;
import com.myhaimi.sms.repository.ClassGroupRepo;
import com.myhaimi.sms.repository.SchoolRepo;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * Bulk class-group CSV import: parse → preview → commit.
 *
 * CSV format:
 *   code,displayName,gradeLevel,section,capacity
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ClassGroupImportService {

    private static final List<String> REQUIRED_COLUMNS = List.of("code", "displayname");
    // code pattern mirrors ClassGroupDTO validation
    private static final String CODE_PATTERN = "^[A-Za-z0-9]+(?:[-_][A-Za-z0-9]+)*$";

    private final ClassGroupImportTokenStore tokenStore;
    private final ClassGroupRepo             classGroupRepo;
    private final SchoolRepo                 schoolRepo;

    @Transactional(readOnly = true)
    public ClassGroupImportPreviewDto preview(MultipartFile file) throws IOException {
        Integer schoolId = requireSchoolId();
        List<ClassGroupImportRowDto> rows = parseCsv(file.getInputStream());
        if (rows.isEmpty()) throw new IllegalArgumentException("CSV contains no data rows.");

        Set<String> existingCodes = loadExistingCodes(schoolId);
        Set<String> seenCodes     = new LinkedHashSet<>();

        List<ClassGroupImportRowResultDto> results   = new ArrayList<>(rows.size());
        List<ClassGroupImportRowDto>       validRows = new ArrayList<>();

        for (ClassGroupImportRowDto row : rows) {
            List<String> errors     = new ArrayList<>();
            boolean      isDuplicate = false;

            if (row.getCode() == null || row.getCode().isBlank()) {
                errors.add("code is required.");
            } else if (!row.getCode().trim().matches(CODE_PATTERN)) {
                errors.add("code must match pattern like '10-A' or 'GRADE6_B' (letters, digits, - or _).");
            } else {
                String codeKey = row.getCode().trim().toLowerCase();
                if (existingCodes.contains(codeKey)) isDuplicate = true;
                else if (seenCodes.contains(codeKey)) isDuplicate = true;
                else seenCodes.add(codeKey);
            }

            if (row.getDisplayName() == null || row.getDisplayName().isBlank())
                errors.add("displayName is required.");

            if (row.getGradeLevel() != null && !row.getGradeLevel().isBlank()) {
                try {
                    int g = Integer.parseInt(row.getGradeLevel().trim());
                    if (g < 0 || g > 20) errors.add("gradeLevel must be between 0 and 20.");
                } catch (NumberFormatException e) { errors.add("gradeLevel must be an integer."); }
            }
            if (row.getCapacity() != null && !row.getCapacity().isBlank()) {
                try {
                    int c = Integer.parseInt(row.getCapacity().trim());
                    if (c <= 0) errors.add("capacity must be > 0.");
                } catch (NumberFormatException e) { errors.add("capacity must be a positive integer."); }
            }

            if (isDuplicate) {
                results.add(ClassGroupImportRowResultDto.duplicate(row, "Class with code '" + row.getCode() + "' already exists in this school."));
            } else if (!errors.isEmpty()) {
                results.add(ClassGroupImportRowResultDto.invalid(row, errors));
            } else {
                results.add(ClassGroupImportRowResultDto.valid(row));
                validRows.add(row);
            }
        }

        String token = tokenStore.store(schoolId, validRows);
        return ClassGroupImportPreviewDto.builder()
                .importToken(token).totalRows(rows.size()).validRows(validRows.size())
                .invalidRows((int) results.stream().filter(r -> r.getStatus() == ClassGroupImportRowResultDto.RowStatus.INVALID).count())
                .duplicateRows((int) results.stream().filter(r -> r.getStatus() == ClassGroupImportRowResultDto.RowStatus.DUPLICATE).count())
                .rows(results).build();
    }

    public ClassGroupImportCommitResultDto commit(ClassGroupImportCommitDto request) {
        Integer schoolId = requireSchoolId();
        List<ClassGroupImportRowDto> validRows = tokenStore.consume(request.getImportToken(), schoolId)
                .orElseThrow(() -> new IllegalStateException("Import session expired or not found."));

        School school = schoolRepo.findById(schoolId).orElseThrow();
        int imported = 0, skipped = 0;
        List<ClassGroupImportRowResultDto> failed = new ArrayList<>();

        for (ClassGroupImportRowDto row : validRows) {
            try {
                String code = row.getCode().trim();
                boolean exists = classGroupRepo.findByCodeAndSchool_Id(code, schoolId)
                        .filter(cg -> !cg.isDeleted()).isPresent();
                if (exists) { skipped++; continue; }

                ClassGroup cg = new ClassGroup();
                cg.setSchool(school);
                cg.setCode(code);
                cg.setDisplayName(row.getDisplayName().trim());
                if (row.getGradeLevel() != null && !row.getGradeLevel().isBlank()) {
                    try { cg.setGradeLevel(Integer.parseInt(row.getGradeLevel().trim())); } catch (NumberFormatException ignored) {}
                }
                if (row.getSection() != null && !row.getSection().isBlank()) cg.setSection(row.getSection().trim());
                if (row.getCapacity() != null && !row.getCapacity().isBlank()) {
                    try { int cap = Integer.parseInt(row.getCapacity().trim()); if (cap > 0) cg.setCapacity(cap); } catch (NumberFormatException ignored) {}
                }
                classGroupRepo.save(cg);
                imported++;
            } catch (Exception ex) {
                log.warn("ClassGroupImport: failed to save row {}: {}", row.getRowNumber(), ex.getMessage());
                failed.add(ClassGroupImportRowResultDto.invalid(row, List.of("Write failed: " + ex.getMessage())));
            }
        }
        return ClassGroupImportCommitResultDto.builder().importedCount(imported).skippedCount(skipped).failedRows(failed).build();
    }

    public void discard(String token) { tokenStore.discard(token); }

    // ── CSV helpers ───────────────────────────────────────────────────────────

    private List<ClassGroupImportRowDto> parseCsv(InputStream input) throws IOException {
        BufferedReader reader = new BufferedReader(new InputStreamReader(stripBom(input), StandardCharsets.UTF_8));
        String headerLine = reader.readLine();
        if (headerLine == null || headerLine.isBlank()) throw new IllegalArgumentException("CSV file is empty or has no header row.");
        List<String> headers = splitCsv(headerLine);
        Map<String, Integer> idx = buildIndex(headers);
        validateRequired(idx, headers);

        List<ClassGroupImportRowDto> rows = new ArrayList<>();
        String line; int rowNum = 0;
        while ((line = reader.readLine()) != null) {
            if (line.isBlank()) continue; rowNum++;
            List<String> f = splitCsv(line);
            ClassGroupImportRowDto row = new ClassGroupImportRowDto();
            row.setRowNumber(rowNum);
            row.setCode(get(f, idx, "code"));
            row.setDisplayName(get(f, idx, "displayname"));
            row.setGradeLevel(get(f, idx, "gradelevel"));
            row.setSection(get(f, idx, "section"));
            row.setCapacity(get(f, idx, "capacity"));
            rows.add(row);
        }
        return rows;
    }

    private static String get(List<String> fields, Map<String, Integer> idx, String key) {
        Integer i = idx.get(key); if (i == null || i >= fields.size()) return null;
        String v = fields.get(i); return (v == null || v.isBlank()) ? null : v.trim();
    }
    private static Map<String, Integer> buildIndex(List<String> headers) {
        Map<String, Integer> map = new HashMap<>();
        for (int i = 0; i < headers.size(); i++) map.put(headers.get(i).toLowerCase().replaceAll("\\s+", ""), i);
        return map;
    }
    private void validateRequired(Map<String, Integer> idx, List<String> headers) {
        List<String> missing = new ArrayList<>();
        for (String col : REQUIRED_COLUMNS) if (!idx.containsKey(col)) missing.add(col);
        if (!missing.isEmpty()) throw new IllegalArgumentException("CSV missing required column(s): " + String.join(", ", missing) + ". Found: " + headers);
    }
    private static List<String> splitCsv(String line) {
        List<String> result = new ArrayList<>(); StringBuilder sb = new StringBuilder(); boolean inQ = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (inQ) { if (c == '"') { if (i+1 < line.length() && line.charAt(i+1) == '"') { sb.append('"'); i++; } else inQ = false; } else sb.append(c); }
            else { if (c == '"') inQ = true; else if (c == ',') { result.add(sb.toString()); sb.setLength(0); } else sb.append(c); }
        }
        result.add(sb.toString()); return result;
    }
    private static InputStream stripBom(InputStream in) throws IOException {
        InputStream buffered = in.markSupported() ? in : new java.io.BufferedInputStream(in);
        buffered.mark(3); byte[] bom = new byte[3]; int read = buffered.read(bom, 0, 3);
        if (read == 3 && bom[0] == (byte) 0xEF && bom[1] == (byte) 0xBB && bom[2] == (byte) 0xBF) return buffered;
        buffered.reset(); return buffered;
    }
    private Set<String> loadExistingCodes(Integer schoolId) {
        Set<String> codes = new HashSet<>();
        classGroupRepo.findAllBySchool_IdAndIsDeletedFalseOrderByGradeLevelAscCodeAsc(schoolId)
                .forEach(cg -> codes.add(cg.getCode().toLowerCase()));
        return codes;
    }
    private Integer requireSchoolId() {
        Integer id = TenantContext.getSchoolId();
        if (id == null) throw new IllegalStateException("Missing school context.");
        return id;
    }
}

