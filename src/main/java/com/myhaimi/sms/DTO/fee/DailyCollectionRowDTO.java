package com.myhaimi.sms.DTO.fee;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

/** One row in the Daily Collection Report (grouped by date + mode). */
@Data
@AllArgsConstructor
@NoArgsConstructor
public class DailyCollectionRowDTO {
    private LocalDate paymentDate;
    private String paymentMode;
    private BigDecimal totalAmount;
    private long paymentCount;
}

