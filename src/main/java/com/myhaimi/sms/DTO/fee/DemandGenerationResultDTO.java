package com.myhaimi.sms.DTO.fee;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

/**
 * Summary returned by the demand-generation (or dry-run preview) operation.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DemandGenerationResultDTO {

    private Integer planId;
    private String planName;
    private boolean dryRun;

    /** Number of students that had at least one applicable fee item. */
    private int totalApplicableStudents;

    /** Number of StudentFeeDemand records created (0 for dry-run). */
    private int createdDemands;

    /** Demands skipped because they already existed. */
    private int skippedExistingDemands;

    /** Sum of all created demand amounts. */
    private BigDecimal totalAmountGenerated;

    /** Non-fatal warnings surfaced during generation. */
    private List<String> warnings;
}
