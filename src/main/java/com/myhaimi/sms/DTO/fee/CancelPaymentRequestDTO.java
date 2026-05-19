package com.myhaimi.sms.DTO.fee;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * Request body for POST /api/fees/payments/{paymentId}/cancel.
 */
@Data
public class CancelPaymentRequestDTO {

    @NotBlank(message = "cancelReason is required")
    private String cancelReason;
}

