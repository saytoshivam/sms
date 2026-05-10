package com.myhaimi.sms.DTO.student;

import lombok.Builder;
import lombok.Data;

/**
 * Included in {@link StudentProfileSummaryDTO} to tell the frontend
 * exactly what the current caller is allowed to see / do for this student.
 * Computed in {@link com.myhaimi.sms.service.impl.StudentAccessGuard}.
 */
@Data
@Builder
public class StudentViewerPermissionsDTO {

    /** Can edit core profile fields (name, DOB, address, status…). */
    private boolean canEdit;

    /** Can transfer student to another class-section. */
    private boolean canTransfer;

    /** Can create / onboard new students. */
    private boolean canCreateStudents;

    /** Guardians tab is fully visible (name, phone, email, relation). */
    private boolean canViewGuardians;

    /** Medical tab is visible. */
    private boolean canViewMedical;

    /** Documents tab is visible. */
    private boolean canViewDocuments;

    /** Fee tab is visible. */
    private boolean canViewFees;

    /** Can create / link parent login for a guardian. */
    private boolean canManageParentLogin;
}

