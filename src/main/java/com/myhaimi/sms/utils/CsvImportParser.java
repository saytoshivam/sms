package com.myhaimi.sms.utils;

import com.myhaimi.sms.DTO.student.importdto.StudentImportRowDto;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Zero-dependency RFC4180-compliant CSV parser for the student bulk import format.
 *
 * <p>Expected header (case-insensitive, extra columns are ignored):
 * <pre>
 * admissionNo,rollNo,firstName,middleName,lastName,gender,dateOfBirth,
 * classCode,sectionCode,academicYear,guardianName,guardianRelation,
 * guardianPhone,guardianEmail,addressLine1,city,state,pincode
 * </pre>
 */
public final class CsvImportParser {

    // Required column names (case-insensitive)
    private static final List<String> REQUIRED_COLUMNS = List.of(
            "admissionno", "firstname", "classcode", "academicyear",
            "guardianname", "guardianphone"
    );

    private CsvImportParser() {}

    /**
     * Parses the uploaded CSV input stream and returns a list of raw row DTOs.
     *
     * @param input CSV bytes (UTF-8 or UTF-8 with BOM)
     * @return ordered list of parsed rows; row numbers start at 1
     * @throws CsvParseException if the header is missing or required columns are absent
     */
    public static List<StudentImportRowDto> parse(InputStream input) throws IOException {
        BufferedReader reader = new BufferedReader(
                new InputStreamReader(stripBom(input), StandardCharsets.UTF_8));

        // --- Parse header -------------------------------------------------------
        String headerLine = reader.readLine();
        if (headerLine == null || headerLine.isBlank()) {
            throw new CsvParseException("CSV file is empty or has no header row.");
        }
        List<String> headers = splitCsvLine(headerLine);
        Map<String, Integer> colIndex = buildColumnIndex(headers);

        validateRequiredColumns(colIndex, headers);

        // --- Parse data rows ----------------------------------------------------
        List<StudentImportRowDto> rows = new ArrayList<>();
        String line;
        int rowNum = 0;
        while ((line = reader.readLine()) != null) {
            if (line.isBlank()) continue;  // skip blank lines
            rowNum++;
            List<String> fields = splitCsvLine(line);
            rows.add(buildRow(rowNum, fields, colIndex));
        }
        return rows;
    }

    // ── Private helpers ──────────────────────────────────────────────────────────

    private static StudentImportRowDto buildRow(
            int rowNum, List<String> fields, Map<String, Integer> colIndex) {

        StudentImportRowDto row = new StudentImportRowDto();
        row.setRowNumber(rowNum);
        row.setAdmissionNo(get(fields, colIndex, "admissionno"));
        row.setRollNo(get(fields, colIndex, "rollno"));
        row.setFirstName(get(fields, colIndex, "firstname"));
        row.setMiddleName(get(fields, colIndex, "middlename"));
        row.setLastName(get(fields, colIndex, "lastname"));
        row.setGender(get(fields, colIndex, "gender"));
        row.setDateOfBirth(get(fields, colIndex, "dateofbirth"));
        row.setClassCode(get(fields, colIndex, "classcode"));
        row.setSectionCode(get(fields, colIndex, "sectioncode"));
        row.setAcademicYear(get(fields, colIndex, "academicyear"));
        row.setGuardianName(get(fields, colIndex, "guardianname"));
        row.setGuardianRelation(get(fields, colIndex, "guardianrelation"));
        row.setGuardianPhone(get(fields, colIndex, "guardianphone"));
        row.setGuardianEmail(get(fields, colIndex, "guardianemail"));
        row.setAddressLine1(get(fields, colIndex, "addressline1"));
        row.setCity(get(fields, colIndex, "city"));
        row.setState(get(fields, colIndex, "state"));
        row.setPincode(get(fields, colIndex, "pincode"));
        return row;
    }

    /** Returns the trimmed value for a column, or null if column is absent or value is blank. */
    private static String get(List<String> fields, Map<String, Integer> index, String colKey) {
        Integer i = index.get(colKey);
        if (i == null || i >= fields.size()) return null;
        String v = fields.get(i);
        return (v == null || v.isBlank()) ? null : v.trim();
    }

    private static Map<String, Integer> buildColumnIndex(List<String> headers) {
        Map<String, Integer> map = new HashMap<>();
        for (int i = 0; i < headers.size(); i++) {
            // normalise: lowercase, strip spaces
            String key = headers.get(i).toLowerCase().replaceAll("\\s+", "");
            map.put(key, i);
        }
        return map;
    }

    private static void validateRequiredColumns(Map<String, Integer> index, List<String> headers) {
        List<String> missing = new ArrayList<>();
        for (String col : REQUIRED_COLUMNS) {
            if (!index.containsKey(col)) {
                missing.add(col);
            }
        }
        if (!missing.isEmpty()) {
            throw new CsvParseException(
                    "CSV is missing required column(s): " + String.join(", ", missing)
                    + ". Found columns: " + headers);
        }
    }

    /**
     * Splits a single CSV line respecting RFC4180 quoting rules.
     * Double-quoted fields may contain commas and escaped quotes ("").
     */
    static List<String> splitCsvLine(String line) {
        List<String> result = new ArrayList<>();
        StringBuilder sb = new StringBuilder();
        boolean inQuotes = false;

        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (inQuotes) {
                if (c == '"') {
                    // Peek next char
                    if (i + 1 < line.length() && line.charAt(i + 1) == '"') {
                        sb.append('"');
                        i++; // skip second quote
                    } else {
                        inQuotes = false;
                    }
                } else {
                    sb.append(c);
                }
            } else {
                if (c == '"') {
                    inQuotes = true;
                } else if (c == ',') {
                    result.add(sb.toString());
                    sb.setLength(0);
                } else {
                    sb.append(c);
                }
            }
        }
        result.add(sb.toString()); // last field
        return result;
    }

    /** Strip UTF-8 BOM if present. */
    private static InputStream stripBom(InputStream in) throws IOException {
        in.mark(3);
        byte[] bom = new byte[3];
        int read = in.read(bom, 0, 3);
        if (read == 3 && bom[0] == (byte) 0xEF && bom[1] == (byte) 0xBB && bom[2] == (byte) 0xBF) {
            return in; // BOM consumed
        }
        in.reset();
        return in;
    }

    // ── Exception ────────────────────────────────────────────────────────────────

    public static class CsvParseException extends RuntimeException {
        public CsvParseException(String message) {
            super(message);
        }
    }
}
