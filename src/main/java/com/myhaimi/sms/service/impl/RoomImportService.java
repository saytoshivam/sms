package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.room.importdto.*;
import com.myhaimi.sms.entity.*;
import com.myhaimi.sms.repository.RoomRepo;
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
 * Bulk room CSV import: parse → preview → commit.
 *
 * CSV format:
 *   building,roomNumber,type,capacity,floorNumber,floorName,isSchedulable
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RoomImportService {

    private static final List<String> REQUIRED_COLUMNS = List.of("building", "roomnumber");

    private final RoomImportTokenStore tokenStore;
    private final RoomRepo             roomRepo;
    private final SchoolRepo           schoolRepo;

    @Transactional(readOnly = true)
    public RoomImportPreviewDto preview(MultipartFile file) throws IOException {
        Integer schoolId = requireSchoolId();
        List<RoomImportRowDto> rows = parseCsv(file.getInputStream());
        if (rows.isEmpty()) throw new IllegalArgumentException("CSV contains no data rows.");

        Set<String> existingKeys = loadExistingKeys(schoolId);
        Set<String> seenKeys     = new LinkedHashSet<>();

        List<RoomImportRowResultDto> results   = new ArrayList<>(rows.size());
        List<RoomImportRowDto>       validRows = new ArrayList<>();

        for (RoomImportRowDto row : rows) {
            List<String> errors     = new ArrayList<>();
            boolean      isDuplicate = false;

            if (row.getBuilding() == null || row.getBuilding().isBlank()) errors.add("building is required.");
            if (row.getRoomNumber() == null || row.getRoomNumber().isBlank()) errors.add("roomNumber is required.");

            if (errors.isEmpty()) {
                String key = row.getBuilding().trim().toLowerCase() + "||" + row.getRoomNumber().trim().toLowerCase();
                if (existingKeys.contains(key)) {
                    isDuplicate = true;
                } else if (seenKeys.contains(key)) {
                    isDuplicate = true;
                } else {
                    seenKeys.add(key);
                }
            }

            if (row.getType() != null && !row.getType().isBlank()) {
                try { RoomType.valueOf(row.getType().toUpperCase().trim()); }
                catch (IllegalArgumentException e) { errors.add("type '" + row.getType() + "' is not valid. Use: STANDARD_CLASSROOM, SCIENCE_LAB, COMPUTER_LAB, MULTIPURPOSE, etc."); }
            }
            if (row.getCapacity() != null && !row.getCapacity().isBlank()) {
                try { int c = Integer.parseInt(row.getCapacity().trim()); if (c <= 0) errors.add("capacity must be > 0."); }
                catch (NumberFormatException e) { errors.add("capacity must be a positive integer."); }
            }
            if (row.getFloorNumber() != null && !row.getFloorNumber().isBlank()) {
                try { Integer.parseInt(row.getFloorNumber().trim()); }
                catch (NumberFormatException e) { errors.add("floorNumber must be an integer."); }
            }

            if (isDuplicate) {
                results.add(RoomImportRowResultDto.duplicate(row, "Room '" + row.getRoomNumber() + "' in building '" + row.getBuilding() + "' already exists."));
            } else if (!errors.isEmpty()) {
                results.add(RoomImportRowResultDto.invalid(row, errors));
            } else {
                results.add(RoomImportRowResultDto.valid(row));
                validRows.add(row);
            }
        }

        String token = tokenStore.store(schoolId, validRows);
        return RoomImportPreviewDto.builder()
                .importToken(token).totalRows(rows.size()).validRows(validRows.size())
                .invalidRows((int) results.stream().filter(r -> r.getStatus() == RoomImportRowResultDto.RowStatus.INVALID).count())
                .duplicateRows((int) results.stream().filter(r -> r.getStatus() == RoomImportRowResultDto.RowStatus.DUPLICATE).count())
                .rows(results).build();
    }

    public RoomImportCommitResultDto commit(RoomImportCommitDto request) {
        Integer schoolId = requireSchoolId();
        List<RoomImportRowDto> validRows = tokenStore.consume(request.getImportToken(), schoolId)
                .orElseThrow(() -> new IllegalStateException("Import session expired or not found. Please re-upload your CSV."));

        School school = schoolRepo.findById(schoolId).orElseThrow();
        int imported = 0, skipped = 0;
        List<RoomImportRowResultDto> failed = new ArrayList<>();

        for (RoomImportRowDto row : validRows) {
            try {
                String bld = row.getBuilding().trim();
                String rno = row.getRoomNumber().trim();
                boolean exists = roomRepo.findBySchool_IdAndBuildingIgnoreCaseAndRoomNumberIgnoreCase(schoolId, bld, rno)
                        .filter(r -> !r.isDeleted()).isPresent();
                if (exists) { skipped++; continue; }

                Room room = new Room();
                room.setSchool(school);
                room.setBuilding(bld);
                room.setRoomNumber(rno);
                if (row.getType() != null && !row.getType().isBlank()) {
                    try { room.setType(RoomType.valueOf(row.getType().toUpperCase().trim())); }
                    catch (IllegalArgumentException ex) { room.setType(RoomType.STANDARD_CLASSROOM); }
                }
                if (row.getCapacity() != null && !row.getCapacity().isBlank()) {
                    try { room.setCapacity(Integer.parseInt(row.getCapacity().trim())); } catch (NumberFormatException ignored) {}
                }
                if (row.getFloorNumber() != null && !row.getFloorNumber().isBlank()) {
                    try { room.setFloorNumber(Integer.parseInt(row.getFloorNumber().trim())); } catch (NumberFormatException ignored) {}
                }
                if (row.getFloorName() != null && !row.getFloorName().isBlank()) room.setFloorName(row.getFloorName().trim());
                boolean schedulable = !"false".equalsIgnoreCase(row.getIsSchedulable() == null ? "" : row.getIsSchedulable().trim());
                room.setSchedulable(schedulable);
                roomRepo.save(room);
                imported++;
            } catch (Exception ex) {
                log.warn("RoomImport: failed to save row {}: {}", row.getRowNumber(), ex.getMessage());
                failed.add(RoomImportRowResultDto.invalid(row, List.of("Write failed: " + ex.getMessage())));
            }
        }
        return RoomImportCommitResultDto.builder().importedCount(imported).skippedCount(skipped).failedRows(failed).build();
    }

    public void discard(String token) { tokenStore.discard(token); }

    // ── CSV helpers ───────────────────────────────────────────────────────────

    private List<RoomImportRowDto> parseCsv(InputStream input) throws IOException {
        BufferedReader reader = new BufferedReader(new InputStreamReader(stripBom(input), StandardCharsets.UTF_8));
        String headerLine = reader.readLine();
        if (headerLine == null || headerLine.isBlank()) throw new IllegalArgumentException("CSV file is empty or has no header row.");
        List<String> headers = splitCsv(headerLine);
        Map<String, Integer> idx = buildIndex(headers);
        validateRequired(idx, headers);

        List<RoomImportRowDto> rows = new ArrayList<>();
        String line; int rowNum = 0;
        while ((line = reader.readLine()) != null) {
            if (line.isBlank()) continue; rowNum++;
            List<String> f = splitCsv(line);
            RoomImportRowDto row = new RoomImportRowDto();
            row.setRowNumber(rowNum);
            row.setBuilding(get(f, idx, "building"));
            row.setRoomNumber(get(f, idx, "roomnumber"));
            row.setType(get(f, idx, "type"));
            row.setCapacity(get(f, idx, "capacity"));
            row.setFloorNumber(get(f, idx, "floornumber"));
            row.setFloorName(get(f, idx, "floorname"));
            row.setIsSchedulable(get(f, idx, "isschedulable"));
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
        if (!missing.isEmpty()) throw new IllegalArgumentException("CSV is missing required column(s): " + String.join(", ", missing) + ". Found: " + headers);
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
    private Set<String> loadExistingKeys(Integer schoolId) {
        Set<String> keys = new HashSet<>();
        roomRepo.findBySchool_IdAndIsDeletedFalse(schoolId).forEach(r ->
                keys.add(r.getBuilding().toLowerCase() + "||" + r.getRoomNumber().toLowerCase()));
        return keys;
    }
    private Integer requireSchoolId() {
        Integer id = TenantContext.getSchoolId();
        if (id == null) throw new IllegalStateException("Missing school context.");
        return id;
    }
}

