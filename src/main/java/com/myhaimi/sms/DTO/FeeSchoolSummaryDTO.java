package com.myhaimi.sms.DTO;

import java.math.BigDecimal;

/**
 * School-wide fee KPIs for owners and leadership (tenant-scoped).
 */
public record FeeSchoolSummaryDTO(
        long studentCount,
        BigDecimal totalInvoiced,
        BigDecimal totalCollected,
        BigDecimal outstandingPending,
        long invoiceCount,
        long openInvoiceCount) {}
