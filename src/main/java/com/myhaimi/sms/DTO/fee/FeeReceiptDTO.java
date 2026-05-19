package com.myhaimi.sms.DTO.fee;

import lombok.Data;

import java.time.Instant;

/**
 * DTO projection of a {@link com.myhaimi.sms.entity.FeeReceipt}.
 */
@Data
public class FeeReceiptDTO {
    private Long id;
    private String receiptNo;
    private Instant issuedAt;
    private String pdfUrl;
    private Instant cancelledAt;
    private String cancelReason;
}

