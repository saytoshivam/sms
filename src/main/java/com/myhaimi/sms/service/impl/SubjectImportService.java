package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.subject.importdto.*;
import com.myhaimi.sms.entity.*;
import com.myhaimi.sms.repository.SchoolRepo;
import com.myhaimi.sms.repository.SubjectRepo;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * Bulk subject CSV import: parse → preview → commit.
 *
 * CSV format:
 *   name,code,type,weeklyFrequency,allocationVenueRequirement
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SubjectImportService {

    private static final List<String> REQUIRED_COLUMNS = List.of("name", "code");
    private static final Set<String>  VALID_TYPES = Set.of("CORE", "OPTIONAL");
    private static final Set<String>  VALID_VENUE_REQS = Set.of(
            "STANDARD_CLASSROOM", "LAB_REQUIRED", "ACTIVITY_SPACE",
            "SPORTS_AREA", "SPECIALIZED_ROOM", "FLEXIBLE");

    private final SubjectImportTokenStore tokenStore;
    private final SubjectRepo             subjectRepo;
    private final SchoolRepo              schoolRepo;

    // ── Preview ───────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public SubjectImportPreviewDto preview(MultipartFile file) throws IOException {
        Integer schoolId = requireSchoolId();

        List<SubjectImportRowDto> rows = parseCsv(file.getInputStream());
        if (rows.isEmpty())
            throw new IllegalArgumentException("CSV contains no data rows (only a header was found).");

        Set<String> existingCodes = loadExistingCodes(schoolId);
        Set<String> seenCodes     = new LinkedHashSet<>();

        List<SubjectImportRowResultDto> results   = new ArrayList<>(rows.size());
        List<SubjectImportRowDto>       validRows = new ArrayList<>();

        for (SubjectImportRowDto row : rows) {
            List<String> errors     = new ArrayList<>();
            boolean      isDuplicate = false;

            // ── name ──────────────────────────────────────────────────────────
            if (row.getName() == null || row.getName().isBlank())
                errors.add("name is required.");

            // ── code ──────────────────────────────────────────────────────────
            String code = row.getCode() == null ? null : row.getCode().toUpperCase().trim();
            if (code == null || code.isBlank()) {
                errors.add("code is required.");
            } else if (!code.matches("[A-Z0-9]{3,32}")) {
                errors.add("code must be 3–32 uppercase letters or digits.");
            } else if (existingCodes.contains(code)) {
                isDuplicate = true;
            } else if (seenCodes.contains(code)) {
                isDuplicate = true;
            } else {
                seenCodes.add(code);
            }

            // ── type ──────────────────────────────────────────────────────────
            if (row.getType() != null && !row.getType().isBlank()
                    && !VALID_TYPES.contains(row.getType().toUpperCase().trim())) {
                errors.add("type must be CORE or OPTIONAL.");
            }

            // ── weeklyFrequency ───────────────────────────────────────────────
            if (row.getWeeklyFrequency() != null && !row.getWeeklyFrequency().isBlank()) {
                try {
                    int wf = Integer.parseInt(row.getWeeklyFrequency().trim());
                    if (wf <= 0) errors.add("weeklyFrequency must be > 0.");
                } catch (NumberFormatException e) {
                    errors.add("weeklyFrequency must be a positive integer.");
                }
            }

            // ── allocationVenueRequirement ───────────────────────────────────
            if (row.getAllocationVenueRequirement() != null && !row.getAllocationVenueRequirement().isBlank()) {
                String avr = row.getAllocationVenueRequirement().toUpperCase().trim();
                if (!VALID_VENUE_REQS.contains(avr)) {
                    errors.add("allocationVenueRequirement must be one of: STANDARD_CLASSROOM, LAB_REQUIRED, ACTIVITY_SPACE, SPORTS_AREA, SPECIALIZED_ROOM, FLEXIBLE.");
                }
            }

            if (isDuplicate) {
                results.add(SubjectImportRowResultDto.duplicate(row, "Subject with code '" + code + "' already exists in this school."));
            } else if (!errors.isEmpty()) {
                results.add(SubjectImportRowResultDto.invalid(row, errors));
            } else {
                results.add(SubjectImportRowResultDto.valid(row));
                validRows.add(row);
            }
        }

        String token = tokenStore.store(schoolId, validRows);

        return SubjectImportPreviewDto.builder()
                .importToken(token)
                .totalRows(rows.size())
                .validRows(validRows.size())
                .invalidRows((int) results.stream().filter(r -> r.getStatus() == SubjectImportRowResultDto.RowStatus.INVALID).count())
                .duplicateRows((int) results.stream().filter(r -> r.getStatus() == SubjectImportRowResultDto.RowStatus.DUPLICATE).count())
                .rows(results)
                .build();
    }

    // ── Commit ────────────────────────────────────────────────────────────────

    public SubjectImportCommitResultDto commit(SubjectImportCommitDto request) {
        Integer schoolId = requireSchoolId();

        List<SubjectImportRowDto> validRows = tokenStore.consume(request.getImportToken(), schoolId)
                .orElseThrow(() -> new IllegalStateException("Import session expired or not found. Please re-upload your CSV."));

        School school = schoolRepo.findById(schoolId).orElseThrow();

        int imported = 0;
        int skipped  = 0;
        List<SubjectImportRowResultDto> failed = new ArrayList<>();

        for (SubjectImportRowDto row : validRows) {
            try {
                String code = row.getCode().toUpperCase().trim();
                // Re-check for duplicates introduced between preview and commit
                boolean exists = subjectRepo.findBySchool_IdAndCode(schoolId, code)
                        .filter(s -> !s.isDeleted()).isPresent();
                if (exists) { skipped++; continue; }

                Subject s = new Subject();
                s.setSchool(school);
                s.setName(row.getName().trim());
                s.setCode(code);
                String typeStr = row.getType() == null || row.getType().isBlank() ? "CORE" : row.getType().toUpperCase().trim();
                try { s.setType(SubjectType.valueOf(typeStr)); } catch (IllegalArgumentException ex) { s.setType(SubjectType.CORE); }
                if (row.getWeeklyFrequency() != null && !row.getWeeklyFrequency().isBlank()) {
                    try { s.setWeeklyFrequency(Integer.parseInt(row.getWeeklyFrequency().trim())); } catch (NumberFormatException ignored) {}
                }
                String avr = row.getAllocationVenueRequirement() == null || row.getAllocationVenueRequirement().isBlank()
                        ? "STANDARD_CLASSROOM" : row.getAllocationVenueRequirement().toUpperCase().trim();
                try { s.setAllocationVenueRequirement(SubjectAllocationVenueRequirement.valueOf(avr)); }
                catch (IllegalArgumentException ex) { s.setAllocationVenueRequirement(SubjectAllocationVenueRequirement.STANDARD_CLASSROOM); }
                subjectRepo.save(s);
                imported++;
            } catch (Exception ex) {
                log.warn("SubjectImport: failed to save row {}: {}", row.getRowNumber(), ex.getMessage());
                SubjectImportRowResultDto r = SubjectImportRowResultDto.invalid(row, List.of("Write failed: " + ex.getMessage()));
                failed.add(r);
            }
        }

        return SubjectImportCommitResultDto.builder()
                .importedCount(imported)
                .skippedCount(skipped)
                .failedRows(failed)
                .build();
    }

    public void discard(String token) { tokenStore.discard(token); }

    // ── CSV parsing ───────────────────────────────────────────────────────────

    private List<SubjectImportRowDto> parseCsv(InputStream input) throws IOException {
        BufferedReader reader = new BufferedReader(new InputStreamReader(stripBom(input), StandardCharsets.UTF_8));
        String headerLine = reader.readLine();
        if (headerLine == null || headerLine.isBlank())
            throw new IllegalArgumentException("CSV file is empty or has no header row.");

        List<String> headers  = splitCsv(headerLine);
        Map<String, Integer> idx = buildIndex(headers);
        validateRequired(idx, headers);

        List<SubjectImportRowDto> rows = new ArrayList<>();
        String line; int rowNum = 0;
        while ((line = reader.readLine()) != null) {
            if (line.isBlank()) continue;
            rowNum++;
            List<String> f = splitCsv(line);
            SubjectImportRowDto row = new SubjectImportRowDto();
            row.setRowNumber(rowNum);
            row.setName(get(f, idx, "name"));
            row.setCode(get(f, idx, "code"));
            row.setType(get(f, idx, "type"));
            row.setWeeklyFrequency(get(f, idx, "weeklyfrequency"));
            row.setAllocationVenueRequirement(get(f, idx, "allocationvenuerequirement"));
            rows.add(row);
        }
        return rows;
    }

    private static String get(List<String> fields, Map<String, Integer> idx, String key) {
        Integer i = idx.get(key);
        if (i == null || i >= fields.size()) return null;
        String v = fields.get(i);
        return (v == null || v.isBlank()) ? null : v.trim();
    }

    private static Map<String, Integer> buildIndex(List<String> headers) {
        Map<String, Integer> map = new HashMap<>();
        for (int i = 0; i < headers.size(); i++)
            map.put(headers.get(i).toLowerCase().replaceAll("\\s+", ""), i);
        return map;
    }

    private void validateRequired(Map<String, Integer> idx, List<String> headers) {
        List<String> missing = new ArrayList<>();
        for (String col : REQUIRED_COLUMNS) if (!idx.containsKey(col)) missing.add(col);
        if (!missing.isEmpty())
            throw new IllegalArgumentException("CSV is missing required column(s): " + String.join(", ", missing)
                    + ". Found columns: " + headers);
    }

    private static List<String> splitCsv(String line) {
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
        in.mark(3);
        byte[] bom = new byte[3];
        int read = in.read(bom, 0, 3);
        if (read == 3 && bom[0] == (byte) 0xEF && bom[1] == (byte) 0xBB && bom[2] == (byte) 0xBF) return in;
        in.reset();
        return in;
    }

    private Set<String> loadExistingCodes(Integer schoolId) {
        Set<String> codes = new HashSet<>();
        subjectRepo.findBySchool_IdAndIsDeletedFalseOrderByCodeAsc(schoolId)
                .forEach(s -> codes.add(s.getCode().toUpperCase()));
        return codes;
    }

    private Integer requireSchoolId() {
        Integer id = TenantContext.getSchoolId();
        if (id == null) throw new IllegalStateException("Missing school context.");
        return id;
    }
}





