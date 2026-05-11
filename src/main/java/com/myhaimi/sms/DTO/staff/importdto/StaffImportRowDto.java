package com.myhaimi.sms.DTO.staff.importdto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * Parsed (raw) row from the staff import CSV.
 * Fields are set directly from CSV cells — validation happens in the service.
 */
@Data
public class StaffImportRowDto {

    private int rowNumber;

    // ── Identity ──────────────────────────────────────────────────────────────
    private String employeeNo;
    private String fullName;
    private String phone;
    private String email;
    private String gender;
    private String dateOfBirth;          // yyyy-MM-dd

    // ── Employment ────────────────────────────────────────────────────────────
    private String staffType;            // TEACHING | NON_TEACHING | ADMIN | SUPPORT
    private String designation;
    private String department;
    private String joiningDate;          // yyyy-MM-dd
    private String employmentType;       // FULL_TIME | PART_TIME | CONTRACT | VISITING

    // ── Roles & access ────────────────────────────────────────────────────────
    private String roles;                // comma-separated, e.g. "TEACHER,CLASS_TEACHER"
    private String createLoginAccount;   // true / false / yes / no

    // ── Academic capabilities ──────────────────────────────────────────���──────
    private String subjectCodes;         // comma-separated, e.g. "MATH,PHY"
    private String maxWeeklyLectureLoad;
    private String canBeClassTeacher;    // true/false
    private String canTakeSubstitution;  // true/false

    // ── Address ───────────────────────────────────────────────────────────────
    private String addressLine1;
    private String city;
    private String state;
    private String pincode;

    // ── Emergency contact ─────────────────────────────────────────────────────
    private String emergencyContactName;
    private String emergencyContactPhone;

    // ── Qualifications ────────────────────────────────────────────────────────
    private String highestQualification;
    private String professionalQualification;

    // ── Resolved during preview (not from CSV) ────────────────────────────────
    /** Subject PKs resolved from subjectCodes during preview. */
    private List<Integer> resolvedSubjectIds = new ArrayList<>();
}

