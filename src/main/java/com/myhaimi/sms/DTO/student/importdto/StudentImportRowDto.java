package com.myhaimi.sms.DTO.student.importdto;

import lombok.Data;

/**
 * Represents a single raw + resolved row from the import CSV.
 * Used internally between the parser, validator, and token store.
 */
@Data
public class StudentImportRowDto {

    /** 1-based row number (header = 0, data starts at 1). */
    private int rowNumber;

    // ── Raw CSV fields ──────────────────────────────────────────────────────

    private String admissionNo;
    private String rollNo;
    private String firstName;
    private String middleName;
    private String lastName;
    private String gender;
    /** Raw date string from CSV – "yyyy-MM-dd" expected. */
    private String dateOfBirth;
    private String classCode;
    private String sectionCode;
    private String academicYear;
    private String guardianName;
    private String guardianRelation;
    private String guardianPhone;
    private String guardianEmail;
    private String addressLine1;
    private String city;
    private String state;
    private String pincode;

    // ── Resolved IDs (filled during validation) ─────────────────────────────

    private Integer resolvedClassGroupId;
    private Integer resolvedAcademicYearId;
}

