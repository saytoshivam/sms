package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.student.importdto.StudentImportRowDto;
import com.myhaimi.sms.entity.*;
import com.myhaimi.sms.entity.enums.StudentAcademicEnrollmentStatus;
import com.myhaimi.sms.entity.enums.StudentEnrollmentAdmissionCategory;
import com.myhaimi.sms.entity.enums.StudentLifecycleStatus;
import com.myhaimi.sms.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Handles single-row persistence for the student bulk import.
 * Extracted into its own Spring bean so that {@code @Transactional}
 * is honoured via the AOP proxy (avoids self-invocation pitfall).
 */
@Service
@RequiredArgsConstructor
public class StudentRowPersistService {

    private final StudentRepo studentRepo;
    private final ClassGroupRepo classGroupRepo;
    private final AcademicYearRepo academicYearRepo;
    private final StudentAcademicEnrollmentRepo enrollmentRepo;
    private final GuardianRepo guardianRepo;
    private final StudentGuardianRepo studentGuardianRepo;

    /**
     * Persists one student row within its own DB transaction.
     * Throws {@link IllegalArgumentException} for detectable errors
     * (e.g., concurrent duplicate) so the caller can mark the row as failed.
     */
    @Transactional
    public void persist(School school, StudentImportRowDto row) {
        // Guard: double-check admissionNo uniqueness (concurrent import)
        if (studentRepo.findBySchool_IdAndAdmissionNo(school.getId(), row.getAdmissionNo()).isPresent()) {
            throw new IllegalArgumentException(
                    "admissionNo '" + row.getAdmissionNo() + "' already exists (concurrent duplicate).");
        }

        ClassGroup classGroup = classGroupRepo.findById(row.getResolvedClassGroupId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Class group id=" + row.getResolvedClassGroupId() + " not found at commit time."));
        AcademicYear academicYear = academicYearRepo.findById(row.getResolvedAcademicYearId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Academic year id=" + row.getResolvedAcademicYearId() + " not found at commit time."));

        // ── Student ────────────────────────────────────────────────────────────────
        Student student = new Student();
        student.setSchool(school);
        student.setAdmissionNo(row.getAdmissionNo().trim());
        student.setFirstName(row.getFirstName().trim());
        student.setMiddleName(blankToNull(row.getMiddleName()));
        student.setLastName(blankToNull(row.getLastName()));
        student.setGender(blankToNull(row.getGender()));
        student.setStatus(StudentLifecycleStatus.ACTIVE);
        student.setClassGroup(classGroup);

        String dob = blankToNull(row.getDateOfBirth());
        if (dob != null) student.setDateOfBirth(LocalDate.parse(dob));

        student.setAddress(composeAddress(row.getAddressLine1(), null, row.getCity(), row.getState(), row.getPincode()));
        studentRepo.save(student);

        // ── Enrollment ─────────────────────────────────────────────────────────────
        String rollNo = blankToNull(row.getRollNo());
        StudentAcademicEnrollment enr = new StudentAcademicEnrollment();
        enr.setStudent(student);
        enr.setAcademicYear(academicYear);
        enr.setClassGroup(classGroup);
        enr.setRollNo(rollNo);
        enr.setAdmissionDate(LocalDate.now());
        enr.setJoiningDate(LocalDate.now());
        enr.setStatus(StudentAcademicEnrollmentStatus.ACTIVE);
        enr.setAdmissionCategory(StudentEnrollmentAdmissionCategory.NEW_ADMISSION);
        enrollmentRepo.save(enr);

        // ── Guardian ───────────────────────────────────────────────────────────────
        if (blankToNull(row.getGuardianName()) != null) {
            Guardian guardian = new Guardian();
            guardian.setSchool(school);
            guardian.setName(row.getGuardianName().trim());
            guardian.setPhone(row.getGuardianPhone().trim());
            guardian.setEmail(blankToNull(row.getGuardianEmail()));
            guardianRepo.save(guardian);

            StudentGuardian link = new StudentGuardian();
            link.setStudent(student);
            link.setGuardian(guardian);
            link.setRelation(blankToNull(row.getGuardianRelation()) != null
                    ? row.getGuardianRelation().trim() : "Guardian");
            link.setPrimaryGuardian(true);
            link.setReceivesNotifications(true);
            link.setCanLogin(false);
            studentGuardianRepo.save(link);
        }
    }

    // ── Static helpers ────────────────────────────────────────────────────────────

    private static String blankToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static String composeAddress(String line1, String line2, String city, String state, String pincode) {
        List<String> parts = new ArrayList<>();
        if (blankToNull(line1) != null)  parts.add(line1.trim());
        if (blankToNull(line2) != null)  parts.add(line2.trim());
        StringBuilder locality = new StringBuilder();
        if (blankToNull(city)    != null) locality.append(city.trim());
        if (blankToNull(state)   != null) { if (!locality.isEmpty()) locality.append(", "); locality.append(state.trim()); }
        if (blankToNull(pincode) != null) { if (!locality.isEmpty()) locality.append(" "); locality.append(pincode.trim()); }
        if (!locality.isEmpty()) parts.add(locality.toString());
        if (parts.isEmpty()) return null;
        String combined = String.join("\n", parts);
        return combined.length() > 256 ? combined.substring(0, 256) : combined;
    }
}

