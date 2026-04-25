package com.myhaimi.sms.DTO;

import java.math.BigDecimal;

public record FeeOnlinePaymentIntentResponse(
        Integer paymentId,
        String gatewayOrderId,
        String gatewayStatus,
        BigDecimal amount,
        String invoiceStatus
) {}
