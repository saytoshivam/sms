package com.myhaimi.sms.DTO.staff.onboarding;

import com.myhaimi.sms.entity.enums.EmploymentType;
import com.myhaimi.sms.entity.enums.StaffStatus;
import com.myhaimi.sms.entity.enums.StaffType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;

/** Employment classification and organisational placement. */
@Data
public class StaffEmploymentDTO {

    @NotNull(message = "Staff type is required.")
    private StaffType staffType;

    @NotBlank(message = "Designation is required.")
    private String designation;

    private String department;

    /**
     * Required before a staff member can be activated (status = ACTIVE).
     * Validated cross-field in the service when status = ACTIVE.
     */
    private LocalDate joiningDate;

    private EmploymentType employmentType;

    /** Nullable FK to another staff row in the same school. */
    private Integer reportingManagerStaffId;

    /**
     * Explicit status override. When null the service defaults to DRAFT for new
     * records and leaves existing records unchanged.
     */
    private StaffStatus status;
}
