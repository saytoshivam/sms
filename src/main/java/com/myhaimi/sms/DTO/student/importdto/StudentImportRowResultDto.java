package com.myhaimi.sms.DTO.student.importdto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * Per-row result returned in the preview response.
 */
@Data
public class StudentImportRowResultDto {

    public enum RowStatus { VALID, INVALID, DUPLICATE }

    private int rowNumber;
    private String admissionNo;
    private String firstName;
    private String lastName;
    private String classCode;
    private String academicYear;
    private RowStatus status;
    private List<String> errors = new ArrayList<>();

    public static StudentImportRowResultDto valid(StudentImportRowDto row) {
        StudentImportRowResultDto r = new StudentImportRowResultDto();
        r.rowNumber   = row.getRowNumber();
        r.admissionNo = row.getAdmissionNo();
        r.firstName   = row.getFirstName();
        r.lastName    = row.getLastName();
        r.classCode   = row.getClassCode();
        r.academicYear = row.getAcademicYear();
        r.status = RowStatus.VALID;
        return r;
    }

    public static StudentImportRowResultDto invalid(StudentImportRowDto row, List<String> errors) {
        StudentImportRowResultDto r = new StudentImportRowResultDto();
        r.rowNumber   = row.getRowNumber();
        r.admissionNo = row.getAdmissionNo();
        r.firstName   = row.getFirstName();
        r.lastName    = row.getLastName();
        r.classCode   = row.getClassCode();
        r.academicYear = row.getAcademicYear();
        r.status = RowStatus.INVALID;
        r.errors = new ArrayList<>(errors);
        return r;
    }

    public static StudentImportRowResultDto duplicate(StudentImportRowDto row, String reason) {
        StudentImportRowResultDto r = new StudentImportRowResultDto();
        r.rowNumber   = row.getRowNumber();
        r.admissionNo = row.getAdmissionNo();
        r.firstName   = row.getFirstName();
        r.lastName    = row.getLastName();
        r.classCode   = row.getClassCode();
        r.academicYear = row.getAcademicYear();
        r.status = RowStatus.DUPLICATE;
        r.errors = List.of(reason);
        return r;
    }
}

