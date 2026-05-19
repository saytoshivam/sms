package com.myhaimi.sms.DTO.fee;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/** One row in the Payment Mode Summary Report. */
@Data
@AllArgsConstructor
@NoArgsConstructor
public class PaymentModeRowDTO {
    private String paymentMode;
    private BigDecimal totalAmount;
    private long paymentCount;
}

