package com.myhaimi.sms.service.impl;

import com.lowagie.text.*;
import com.lowagie.text.pdf.*;
import com.myhaimi.sms.entity.*;
import com.myhaimi.sms.repository.*;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Generates a PDF byte stream for a fee payment receipt.
 *
 * <p>Uses OpenPDF (com.lowagie.text.*) for PDF construction.
 * The school name is read from the FeePayment entity's school context,
 * ensuring the correct name is always embedded in the PDF.</p>
 */
@Service
@RequiredArgsConstructor
public class FeeReceiptPdfService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final DateTimeFormatter DATE_FMT     = DateTimeFormatter.ofPattern("dd MMM yyyy");
    private static final DateTimeFormatter DATETIME_FMT = DateTimeFormatter.ofPattern("dd MMM yyyy, hh:mm a");

    // Palette
    private static final Color CLR_HEADER_BG   = new Color(239, 246, 255);  // light blue
    private static final Color CLR_HEADER_TEXT  = new Color(30,  64, 175);   // blue-700
    private static final Color CLR_TITLE        = new Color(50,  50,  90);
    private static final Color CLR_LABEL        = new Color(100, 116, 139);  // slate-500
    private static final Color CLR_BODY         = new Color(30,  41,  59);   // slate-800
    private static final Color CLR_GREEN        = new Color(22, 101,  52);   // green-800
    private static final Color CLR_INDIGO       = new Color(79,  70, 229);
    private static final Color CLR_RED          = new Color(185,  28,  28);
    private static final Color CLR_CANCEL_BG    = new Color(254, 226, 226);
    private static final Color CLR_TABLE_HDR_BG = new Color(241, 245, 249);  // slate-100
    private static final Color CLR_TABLE_BORDER = new Color(203, 213, 225);  // slate-300
    private static final Color CLR_ROW_ALT      = new Color(248, 250, 252);  // slate-50
    private static final Color CLR_FOOTER       = new Color(148, 163, 184);

    private final FeePaymentRepo              paymentRepo;
    private final FeeReceiptRepository        receiptRepo;
    private final FeePaymentAllocationRepository allocationRepo;
    private final UserRepo                    userRepo;

    @Transactional(readOnly = true)
    public byte[] generateReceiptPdf(Long paymentId) {
        Integer schoolId = TenantContext.getTenantId();
        if (schoolId == null) throw new IllegalStateException("Missing school context");

        FeePayment payment = paymentRepo.findByIdAndSchool_Id(paymentId, schoolId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Payment not found or access denied: " + paymentId));

        FeeReceipt receipt = receiptRepo.findByPayment_Id(paymentId)
                .orElseThrow(() -> new IllegalStateException(
                        "Receipt record not found for payment " + paymentId));

        List<FeePaymentAllocation> allocations = allocationRepo.findByPayment_Id(paymentId);

        String collectedByName = resolveCollectedBy(payment.getCollectedByUserId());
        boolean isCancelled = receipt.getCancelledAt() != null;

        School  school  = payment.getSchool();
        Student student = payment.getStudent();

        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            Document doc = new Document(PageSize.A4, 40, 40, 40, 40);
            PdfWriter.getInstance(doc, baos);
            doc.open();

            addHeader(doc, school.getName(), receipt, isCancelled);
            if (isCancelled) addCancelledBanner(doc, receipt);
            addStudentSection(doc, student);
            addPaymentSection(doc, payment, collectedByName, isCancelled);
            if (!allocations.isEmpty()) addAllocationsTable(doc, allocations, payment.getAmount());
            addFooter(doc);

            doc.close();
            return baos.toByteArray();

        } catch (Exception e) {
            throw new RuntimeException("PDF generation failed: " + e.getMessage(), e);
        }
    }

    // ─── Header ──────────────────────────────────────────────────────────────

    private void addHeader(Document doc, String schoolName, FeeReceipt receipt, boolean isCancelled)
            throws DocumentException {

        Font fSchool   = new Font(Font.HELVETICA, 18, Font.BOLD,   CLR_HEADER_TEXT);
        Font fTitle    = new Font(Font.HELVETICA, 12, Font.BOLD,   CLR_TITLE);
        Font fLabelSm  = new Font(Font.HELVETICA,  8, Font.NORMAL, CLR_LABEL);
        Font fValueSm  = new Font(Font.HELVETICA,  9, Font.BOLD,   CLR_BODY);
        Font fReceiptNo = new Font(Font.COURIER,  10, Font.BOLD,   CLR_INDIGO);

        PdfPTable outer = new PdfPTable(1);
        outer.setWidthPercentage(100);
        outer.setSpacingAfter(14);

        PdfPCell cell = new PdfPCell();
        cell.setBackgroundColor(CLR_HEADER_BG);
        cell.setBorderColor(CLR_TABLE_BORDER);
        cell.setPadding(12);
        cell.setHorizontalAlignment(Element.ALIGN_CENTER);

        // School name
        Paragraph schoolPara = new Paragraph(schoolName, fSchool);
        schoolPara.setAlignment(Element.ALIGN_CENTER);
        cell.addElement(schoolPara);

        // "Fee Payment Receipt"
        Paragraph titlePara = new Paragraph("Fee Payment Receipt", fTitle);
        titlePara.setAlignment(Element.ALIGN_CENTER);
        titlePara.setSpacingBefore(2);
        cell.addElement(titlePara);

        // Separator line
        Paragraph sep = new Paragraph("────────────────────────────────────────────────────", fLabelSm);
        sep.setAlignment(Element.ALIGN_CENTER);
        sep.setSpacingBefore(6);
        sep.setSpacingAfter(6);
        cell.addElement(sep);

        // Receipt No + Issued Date in two columns
        PdfPTable meta = new PdfPTable(new float[]{1, 1});
        meta.setWidthPercentage(100);
        meta.getDefaultCell().setBorder(PdfPCell.NO_BORDER);
        meta.addCell(kvCell("Receipt No", receipt.getReceiptNo(), fLabelSm, fReceiptNo, Element.ALIGN_LEFT));
        meta.addCell(kvCell("Date", formatInstant(receipt.getIssuedAt()), fLabelSm, fValueSm, Element.ALIGN_RIGHT));
        cell.addElement(meta);

        outer.addCell(cell);
        doc.add(outer);
    }

    // ─── Cancelled banner ────────────────────────────────────────────────────

    private void addCancelledBanner(Document doc, FeeReceipt receipt) throws DocumentException {
        Font fCancelled = new Font(Font.HELVETICA, 16, Font.BOLD, CLR_RED);
        Font fReason    = new Font(Font.HELVETICA,  9, Font.ITALIC, CLR_RED);

        PdfPTable t = new PdfPTable(1);
        t.setWidthPercentage(100);
        t.setSpacingAfter(10);

        PdfPCell c = new PdfPCell(new Paragraph("CANCELLED RECEIPT", fCancelled));
        c.setBackgroundColor(CLR_CANCEL_BG);
        c.setHorizontalAlignment(Element.ALIGN_CENTER);
        c.setPadding(8);
        c.setBorderColor(CLR_RED);
        t.addCell(c);
        doc.add(t);

        if (receipt.getCancelReason() != null && !receipt.getCancelReason().isBlank()) {
            Paragraph reason = new Paragraph("Cancellation reason: " + receipt.getCancelReason(), fReason);
            reason.setAlignment(Element.ALIGN_CENTER);
            reason.setSpacingAfter(8);
            doc.add(reason);
        }
    }

    // ─── Student section ─────────────────────────────────────────────────────

    private void addStudentSection(Document doc, Student student) throws DocumentException {
        Font fSection = new Font(Font.HELVETICA, 8, Font.BOLD, CLR_LABEL);
        Font fLabel   = new Font(Font.HELVETICA, 8, Font.NORMAL, CLR_LABEL);
        Font fValue   = new Font(Font.HELVETICA, 10, Font.BOLD, CLR_BODY);

        sectionLabel(doc, "STUDENT DETAILS", fSection);

        String fullName = student.getFirstName()
                + (student.getLastName() != null && !student.getLastName().isBlank()
                   ? " " + student.getLastName() : "");
        String classLabel = student.getClassGroup() != null
                ? student.getClassGroup().getDisplayName() : "—";

        PdfPTable t = threeColTable();
        t.setSpacingAfter(12);
        t.addCell(kvCell("Student Name", fullName, fLabel, fValue, Element.ALIGN_LEFT));
        t.addCell(kvCell("Admission No", student.getAdmissionNo(), fLabel, fValue, Element.ALIGN_LEFT));
        t.addCell(kvCell("Class / Section", classLabel, fLabel, fValue, Element.ALIGN_LEFT));
        doc.add(t);
    }

    // ─── Payment section ─────────────────────────────────────────────────────

    private void addPaymentSection(Document doc, FeePayment payment,
                                    String collectedBy, boolean isCancelled) throws DocumentException {
        Font fSection = new Font(Font.HELVETICA, 8, Font.BOLD, CLR_LABEL);
        Font fLabel   = new Font(Font.HELVETICA, 8, Font.NORMAL, CLR_LABEL);
        Font fValue   = new Font(Font.HELVETICA, 10, Font.BOLD, CLR_BODY);
        Font fGreen   = new Font(Font.HELVETICA, 10, Font.BOLD, CLR_GREEN);
        Font fRed     = new Font(Font.HELVETICA, 10, Font.BOLD, CLR_RED);

        sectionLabel(doc, "PAYMENT DETAILS", fSection);

        PdfPTable t = threeColTable();
        t.setSpacingAfter(12);
        t.addCell(kvCell("Amount Paid", fmtAmount(payment.getAmount()), fLabel, fGreen, Element.ALIGN_LEFT));
        t.addCell(kvCell("Payment Mode", payment.getPaymentMode().name(), fLabel, fValue, Element.ALIGN_LEFT));
        t.addCell(kvCell("Payment Date", fmtDate(payment.getPaymentDate()), fLabel, fValue, Element.ALIGN_LEFT));
        t.addCell(kvCell("Reference No", orDash(payment.getReferenceNo()), fLabel, fValue, Element.ALIGN_LEFT));
        t.addCell(kvCell("Collected By", collectedBy, fLabel, fValue, Element.ALIGN_LEFT));
        t.addCell(kvCell("Status", payment.getStatus().name(), fLabel,
                isCancelled ? fRed : fGreen, Element.ALIGN_LEFT));
        doc.add(t);
    }

    // ─── Allocations table ───────────────────────────────────────────────────

    private void addAllocationsTable(Document doc, List<FeePaymentAllocation> allocations,
                                      BigDecimal totalAmount) throws DocumentException {
        Font fSection   = new Font(Font.HELVETICA, 8, Font.BOLD, CLR_LABEL);
        Font fTblHeader = new Font(Font.HELVETICA, 9, Font.BOLD, CLR_LABEL);
        Font fNormal    = new Font(Font.HELVETICA, 9, Font.NORMAL, CLR_BODY);
        Font fDemandNo  = new Font(Font.COURIER,   9, Font.NORMAL, CLR_INDIGO);
        Font fAmtCell   = new Font(Font.HELVETICA, 9, Font.BOLD,   CLR_GREEN);
        Font fTotal     = new Font(Font.HELVETICA, 9, Font.BOLD,   CLR_GREEN);
        Font fTotalLbl  = new Font(Font.HELVETICA, 9, Font.BOLD,   CLR_BODY);

        sectionLabel(doc, "FEE BREAKDOWN", fSection);

        PdfPTable t = new PdfPTable(new float[]{3, 2.5f, 2, 1.5f});
        t.setWidthPercentage(100);
        t.setSpacingAfter(16);

        // Header row
        for (String h : new String[]{"Fee Head", "Installment", "Demand No", "Amount"}) {
            PdfPCell hc = new PdfPCell(new Phrase(h, fTblHeader));
            hc.setBackgroundColor(CLR_TABLE_HDR_BG);
            hc.setPadding(7);
            hc.setBorderColor(CLR_TABLE_BORDER);
            hc.setHorizontalAlignment(h.equals("Amount") ? Element.ALIGN_RIGHT : Element.ALIGN_LEFT);
            t.addCell(hc);
        }

        // Data rows
        boolean alt = false;
        for (FeePaymentAllocation alloc : allocations) {
            StudentFeeDemand demand = alloc.getStudentFeeDemand();
            FeeHead feeHead = demand.getFeeHead();
            FeeInstallment inst = demand.getInstallment();

            Color rowBg = alt ? CLR_ROW_ALT : Color.WHITE;
            alt = !alt;

            t.addCell(dataCell(feeHead != null ? feeHead.getName() : "—", fNormal, rowBg, Element.ALIGN_LEFT));
            t.addCell(dataCell(inst != null ? inst.getName() : "—", fNormal, rowBg, Element.ALIGN_LEFT));
            t.addCell(dataCell(demand.getDemandNo(), fDemandNo, rowBg, Element.ALIGN_LEFT));
            t.addCell(dataCell(fmtAmount(alloc.getAllocatedAmount()), fAmtCell, rowBg, Element.ALIGN_RIGHT));
        }

        // Total row
        PdfPCell totalLabelCell = new PdfPCell(new Phrase("Total", fTotalLbl));
        totalLabelCell.setColspan(3);
        totalLabelCell.setHorizontalAlignment(Element.ALIGN_RIGHT);
        totalLabelCell.setPadding(7);
        totalLabelCell.setBorderColor(CLR_TABLE_BORDER);
        totalLabelCell.setBackgroundColor(CLR_ROW_ALT);
        t.addCell(totalLabelCell);

        PdfPCell totalCell = new PdfPCell(new Phrase(fmtAmount(totalAmount), fTotal));
        totalCell.setHorizontalAlignment(Element.ALIGN_RIGHT);
        totalCell.setPadding(7);
        totalCell.setBorderColor(CLR_TABLE_BORDER);
        totalCell.setBackgroundColor(CLR_ROW_ALT);
        t.addCell(totalCell);

        doc.add(t);
    }

    // ─── Footer ──────────────────────────────────────────────────────────────

    private void addFooter(Document doc) throws DocumentException {
        Font fLine   = new Font(Font.HELVETICA, 8, Font.NORMAL, CLR_FOOTER);
        Font fSign   = new Font(Font.HELVETICA, 9, Font.NORMAL, CLR_LABEL);

        Paragraph sep = new Paragraph("────────────────────────────────────────────────────────────────────", fLine);
        sep.setAlignment(Element.ALIGN_CENTER);
        sep.setSpacingBefore(8);
        doc.add(sep);

        Paragraph note = new Paragraph("This is a computer-generated receipt. No signature is required.", fLine);
        note.setAlignment(Element.ALIGN_CENTER);
        note.setSpacingBefore(4);
        doc.add(note);

        Paragraph sign = new Paragraph("Authorized Signatory", fSign);
        sign.setAlignment(Element.ALIGN_RIGHT);
        sign.setSpacingBefore(28);
        doc.add(sign);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private void sectionLabel(Document doc, String title, Font font) throws DocumentException {
        Paragraph p = new Paragraph(title, font);
        p.setSpacingBefore(6);
        p.setSpacingAfter(3);
        doc.add(p);
    }

    private PdfPTable threeColTable() {
        PdfPTable t = new PdfPTable(3);
        t.setWidthPercentage(100);
        t.getDefaultCell().setBorder(PdfPCell.NO_BORDER);
        return t;
    }

    /** Key-value cell: label on top (small), value below. */
    private PdfPCell kvCell(String label, String value, Font labelFont, Font valueFont, int align) {
        PdfPCell cell = new PdfPCell();
        cell.setBorder(PdfPCell.NO_BORDER);
        cell.setPadding(4);
        cell.setHorizontalAlignment(align);

        Paragraph lbl = new Paragraph(label, labelFont);
        lbl.setAlignment(align);
        cell.addElement(lbl);

        Paragraph val = new Paragraph(value != null ? value : "—", valueFont);
        val.setAlignment(align);
        cell.addElement(val);

        return cell;
    }

    private PdfPCell dataCell(String value, Font font, Color bg, int align) {
        PdfPCell cell = new PdfPCell(new Phrase(value != null ? value : "—", font));
        cell.setPadding(6);
        cell.setBorderColor(CLR_TABLE_BORDER);
        cell.setBackgroundColor(bg);
        cell.setHorizontalAlignment(align);
        return cell;
    }

    private String resolveCollectedBy(Integer userId) {
        if (userId == null) return "—";
        return userRepo.findById(userId)
                .map(u -> u.getUsername())
                .orElse("—");
    }

    private String fmtDate(java.time.LocalDate d) {
        return d != null ? d.format(DATE_FMT) : "—";
    }

    private String formatInstant(java.time.Instant inst) {
        return inst != null ? inst.atZone(IST).format(DATETIME_FMT) : "—";
    }

    private String fmtAmount(BigDecimal amount) {
        if (amount == null) return "Rs. 0.00";
        return String.format("Rs. %,.2f", amount);
    }

    private String orDash(String s) {
        return (s != null && !s.isBlank()) ? s : "—";
    }
}
