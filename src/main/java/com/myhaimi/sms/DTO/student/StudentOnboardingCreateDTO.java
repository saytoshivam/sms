package com.myhaimi.sms.DTO.student;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class StudentOnboardingCreateDTO {

    @Valid
    @NotNull
    private StudentCoreCreateDTO core;

    @Valid
    @NotNull
    private StudentEnrollmentPayloadDTO enrollment;

    @Valid
    private StudentMedicalUpsertPayload medical;

    /**
     * At least one guardian, exactly one with {@link GuardianLinkPayloadDTO#isPrimaryGuardian()}
     * {@code true}.
     */
    @Valid
    @NotEmpty
    private List<GuardianLinkPayloadDTO> guardians;
}
