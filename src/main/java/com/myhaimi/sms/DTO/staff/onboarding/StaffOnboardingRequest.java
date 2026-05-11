package com.myhaimi.sms.DTO.staff.onboarding;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * Structured staff onboarding request.
 * All sections except {@code identity}, {@code employment}, and {@code rolesAndAccess}
 * are optional — they can be filled progressively during onboarding.
 */
@Data
public class StaffOnboardingRequest {

    /** Personal details and primary contact — required. */
    @NotNull(message = "Identity section is required.")
    @Valid
    private StaffIdentityDTO identity;

    /** HR classification and job details — required. */
    @NotNull(message = "Employment section is required.")
    @Valid
    private StaffEmploymentDTO employment;

    /** Role assignment and login provisioning — required. */
    @NotNull(message = "Roles and access section is required.")
    @Valid
    private StaffRolesAndAccessDTO rolesAndAccess;

    /** Teaching load and timetable preferences — optional (fill later). */
    @Valid
    private StaffAcademicCapabilitiesDTO academicCapabilities;

    /** Address and emergency contact — optional. */
    @Valid
    private StaffContactDTO contact;

    /** Academic and professional background — optional. */
    @Valid
    private StaffQualificationDTO qualification;

    /** Payroll setup — optional (requires PAYROLL_ADMIN privilege to set). */
    @Valid
    private StaffPayrollSetupDTO payrollSetup;
}
