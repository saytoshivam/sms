package com.myhaimi.sms.DTO.staff.importdto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * Per-row result returned in the staff import preview response.
 */
@Data
public class StaffImportRowResultDto {

    public enum RowStatus {
        VALID,      // ready to import
        WARN,       // valid but with non-fatal warnings (e.g. TEACHER without subjects)
        INVALID,    // has validation errors, will not be imported
        DUPLICATE   // employeeNo / email already exists in this school
    }

    private int    rowNumber;
    private String employeeNo;
    private String fullName;
    private String phone;
    private String email;
    private String staffType;
    private String designation;
    private String roles;
    private RowStatus status;
    private List<String> errors   = new ArrayList<>();
    private List<String> warnings = new ArrayList<>();

    public static StaffImportRowResultDto valid(StaffImportRowDto row) {
        StaffImportRowResultDto r = base(row);
        r.status = RowStatus.VALID;
        return r;
    }

    public static StaffImportRowResultDto warn(StaffImportRowDto row, List<String> warnings) {
        StaffImportRowResultDto r = base(row);
        r.status   = RowStatus.WARN;
        r.warnings = new ArrayList<>(warnings);
        return r;
    }

    public static StaffImportRowResultDto invalid(StaffImportRowDto row, List<String> errors) {
        StaffImportRowResultDto r = base(row);
        r.status = RowStatus.INVALID;
        r.errors = new ArrayList<>(errors);
        return r;
    }

    public static StaffImportRowResultDto duplicate(StaffImportRowDto row, String reason) {
        StaffImportRowResultDto r = base(row);
        r.status = RowStatus.DUPLICATE;
        r.errors = List.of(reason);
        return r;
    }

    private static StaffImportRowResultDto base(StaffImportRowDto row) {
        StaffImportRowResultDto r = new StaffImportRowResultDto();
        r.rowNumber   = row.getRowNumber();
        r.employeeNo  = row.getEmployeeNo();
        r.fullName    = row.getFullName();
        r.phone       = row.getPhone();
        r.email       = row.getEmail();
        r.staffType   = row.getStaffType();
        r.designation = row.getDesignation();
        r.roles       = row.getRoles();
        return r;
    }
}

