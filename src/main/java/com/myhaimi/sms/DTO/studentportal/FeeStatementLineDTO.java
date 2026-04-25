package com.myhaimi.sms.DTO.studentportal;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * One ledger row for the student fee statement (charge = DR, receipt/waiver = CR).
 */
public record FeeStatementLineDTO(
        LocalDate entryDate,
        BigDecimal amount,
        String drCr,
        String description,
        BigDecimal balanceAfter
) {}
