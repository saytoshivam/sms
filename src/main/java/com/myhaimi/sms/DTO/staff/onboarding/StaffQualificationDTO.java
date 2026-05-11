package com.myhaimi.sms.DTO.staff.onboarding;

import jakarta.validation.constraints.PositiveOrZero;
import lombok.Data;

/** Academic and professional background. */
@Data
public class StaffQualificationDTO {

    /** Highest academic degree (e.g. B.Ed, M.Sc, Ph.D). */
    private String highestQualification;

    /** Domain-specific professional credential (e.g. CTET, NET). */
    private String professionalQualification;

    /** Subject or domain specialization (e.g. "Mathematics", "Organic Chemistry"). */
    private String specialization;

    @PositiveOrZero(message = "Years of experience must be zero or positive.")
    private Integer yearsOfExperience;

    /** Name of the previous school / institution. */
    private String previousInstitution;
}
