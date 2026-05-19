package com.myhaimi.sms.DTO.fee;

import lombok.Data;

/**
 * Request body for POST /api/fees/plans/{planId}/generate-demands.
 */
@Data
public class DemandGenerationRequestDTO {

    /**
     * When {@code true}, simulate the generation and return a preview without
     * persisting any {@link com.myhaimi.sms.entity.StudentFeeDemand} records.
     */
    private boolean dryRun = false;
}
