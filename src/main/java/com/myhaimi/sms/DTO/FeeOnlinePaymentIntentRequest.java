package com.myhaimi.sms.DTO;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;

import java.math.BigDecimal;

/**
 * Optional partial pay; omit {@code amount} to pay remaining balance (after confirmed payments only).
 */
public record FeeOnlinePaymentIntentRequest(
        @DecimalMin(value = "0.01", inclusive = true)
        @Digits(integer = 10, fraction = 2)
        BigDecimal amount
) {}
