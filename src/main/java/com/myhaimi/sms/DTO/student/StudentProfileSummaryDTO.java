package com.myhaimi.sms.DTO.student;

import com.myhaimi.sms.entity.enums.StudentLifecycleStatus;
import lombok.Data;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Data
public class StudentProfileSummaryDTO {

    private Integer id;
    private String admissionNo;
    private String firstName;
    private String middleName;
    private String lastName;
    private LocalDate dateOfBirth;
    private String gender;
    private String bloodGroup;
    private String photoUrl;
    private StudentLifecycleStatus status;
    private Integer classGroupId;
    private String classGroupDisplayName;
    private String phone;
    private String address;
    private Instant createdAt;
    private Instant updatedAt;

    private StudentEnrollmentSummaryDTO currentEnrollment;

    private List<StudentEnrollmentSummaryDTO> enrollmentHistory;

    private List<GuardianSummaryDTO> guardians;

    private StudentMedicalSummaryDTO medical;

    private List<StudentDocumentSummaryDTO> documents;

    // ── Student portal login info ─────────────────────────────────────────────
    /** Login account status: NOT_CREATED, INVITED, ACTIVE, DISABLED. Always present in GET /api/students/{id}. */
    private String studentLoginStatus;
    /** Username of the linked student user account, null when no login has been created yet. */
    private String studentLoginUsername;
    /** Timestamp of the last invite sent (future use). */
    private Instant studentLoginLastInviteSentAt;
    /** ID of the linked User row with STUDENT role. */
    private Integer studentUserId;

    /**
     * Caller-specific permission flags injected by the service layer.
     * Null when the profile is built internally (e.g. during write operations).
     */
    private StudentViewerPermissionsDTO viewerPermissions;
}
