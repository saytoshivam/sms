package com.myhaimi.sms.modules.exam.service;

import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.Rectangle;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import com.myhaimi.sms.entity.School;
import com.myhaimi.sms.entity.Student;
import com.myhaimi.sms.modules.exam.entity.AssessmentComponent;
import com.myhaimi.sms.modules.exam.entity.AssessmentScheme;
import com.myhaimi.sms.modules.exam.entity.StudentResult;
import com.myhaimi.sms.modules.exam.entity.StudentResultComponent;
import com.myhaimi.sms.modules.exam.entity.enums.ResultStatus;
import com.myhaimi.sms.modules.exam.repository.AssessmentSchemeRepository;
import com.myhaimi.sms.modules.exam.repository.StudentResultRepository;
import com.myhaimi.sms.repository.StudentRepo;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Generates a PDF report card for a student under a given assessment scheme.
 *
 * <p>Only results with status {@link ResultStatus#PUBLISHED} are included.
 * The report card covers all subjects belonging to the scheme.
 * The {@code schemeId} acts as the "result set" identifier.</p>
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ReportCardService {

    private final StudentRepo           studentRepo;
    private final StudentResultRepository resultRepo;
    private final AssessmentSchemeRepository schemeRepo;

    // â”€â”€ Colours (java.awt.Color â€” used by OpenPDF 1.3.x) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    private static final Color DARK_NAVY   = new Color(15,  23,  42);
    private static final Color ACCENT_BLUE = new Color(37,  99, 235);
    private static final Color SLATE_600   = new Color(71,  85, 105);
    private static final Color SLATE_200   = new Color(226, 232, 240);
    private static final Color SLATE_50    = new Color(248, 250, 252);
    private static final Color BLUE_100    = new Color(219, 234, 254);
    private static final Color WHITE       = Color.WHITE;

    // â”€â”€ Public API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    /**
     * Generates and returns the raw PDF bytes for the student's report card.
     *
     * @param studentId the student whose report card is requested
     * @param schemeId  the assessment scheme (identifies the "result set")
     * @return PDF bytes
     */
    public byte[] generateReportCard(Integer studentId, Integer schemeId) throws Exception {
        Integer schoolId = TenantContext.getTenantId();
        if (schoolId == null) throw new IllegalStateException("Missing school context");

        Student student = studentRepo.findByIdAndSchool_Id(studentId, schoolId)
                .orElseThrow(() -> new IllegalArgumentException("Student " + studentId + " not found in this school"));

        School school = student.getSchool();

        AssessmentScheme scheme = schemeRepo.findById(schemeId)
                .filter(s -> s.getSchool().getId().equals(schoolId))
                .orElseThrow(() -> new IllegalArgumentException("Scheme " + schemeId + " not found in this school"));

        List<StudentResult> results = resultRepo
                .findByStudent_IdAndScheme_IdOrderBySubjectNameAsc(studentId, schemeId)
                .stream()
                .filter(r -> r.getStatus() == ResultStatus.PUBLISHED)
                .collect(Collectors.toList());

        if (results.isEmpty()) {
            throw new IllegalStateException(
                    "No published results found for student " + studentId +
                    " under scheme '" + scheme.getName() + "'. " +
                    "Results must be published before a report card can be generated.");
        }

        // Ordered component list from the scheme definition
        List<AssessmentComponent> components = scheme.getComponents().stream()
                .sorted(Comparator.comparingInt(AssessmentComponent::getSequence))
                .collect(Collectors.toList());

        return buildPdf(school, student, scheme, results, components);
    }

    // â”€â”€ PDF builder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    private byte[] buildPdf(
            School school,
            Student student,
            AssessmentScheme scheme,
            List<StudentResult> results,
            List<AssessmentComponent> components) throws Exception {

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        Document doc = new Document(PageSize.A4, 40, 40, 50, 50);
        PdfWriter.getInstance(doc, baos);
        doc.open();

        // â”€â”€ Fonts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        Font fTitle    = new Font(Font.HELVETICA, 20, Font.BOLD,   DARK_NAVY);
        Font fSub      = new Font(Font.HELVETICA, 12, Font.BOLD,   ACCENT_BLUE);
        Font fScheme   = new Font(Font.HELVETICA, 10, Font.NORMAL, SLATE_600);
        Font fLabel    = new Font(Font.HELVETICA,  9, Font.BOLD,   DARK_NAVY);
        Font fValue    = new Font(Font.HELVETICA,  9, Font.NORMAL, DARK_NAVY);
        Font fSection  = new Font(Font.HELVETICA,  9, Font.BOLD,   DARK_NAVY);
        Font fColHdr   = new Font(Font.HELVETICA,  8, Font.BOLD,   DARK_NAVY);
        Font fCell     = new Font(Font.HELVETICA,  8, Font.NORMAL, DARK_NAVY);
        Font fCellBold = new Font(Font.HELVETICA,  8, Font.BOLD,   DARK_NAVY);
        Font fTiny     = new Font(Font.HELVETICA,  7, Font.NORMAL, SLATE_600);
        Font fTinyBold = new Font(Font.HELVETICA,  7, Font.BOLD,   DARK_NAVY);

        // â”€â”€ HEADER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        Paragraph schoolNameP = new Paragraph(school.getName().toUpperCase(), fTitle);
        schoolNameP.setAlignment(Element.ALIGN_CENTER);
        schoolNameP.setSpacingAfter(2);
        doc.add(schoolNameP);

        Paragraph reportCardP = new Paragraph("REPORT CARD", fSub);
        reportCardP.setAlignment(Element.ALIGN_CENTER);
        reportCardP.setSpacingAfter(2);
        doc.add(reportCardP);

        Paragraph schemeP = new Paragraph(scheme.getName(), fScheme);
        schemeP.setAlignment(Element.ALIGN_CENTER);
        schemeP.setSpacingAfter(10);
        doc.add(schemeP);

        doc.add(separator());

        // â”€â”€ STUDENT INFO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        String fullName    = buildFullName(student);
        String admNo       = student.getAdmissionNo();
        String dob         = student.getDateOfBirth() != null ? student.getDateOfBirth().toString() : "\u2014";
        String gender      = nonBlank(student.getGender());
        String classLabel  = results.get(0).getClassGroup().getDisplayName();
        String ayLabel     = results.get(0).getAcademicYear().getLabel();

        PdfPTable info = new PdfPTable(4);
        info.setWidthPercentage(100);
        info.setWidths(new float[]{1.4f, 2.6f, 1.4f, 2.6f});
        info.setSpacingBefore(6);
        info.setSpacingAfter(12);
        info.getDefaultCell().setBorder(Rectangle.NO_BORDER);

        infoRow(info, "Student Name",   fullName,    "Admission No.",  admNo,      fLabel, fValue);
        infoRow(info, "Class / Section", classLabel, "Academic Year",  ayLabel,    fLabel, fValue);
        infoRow(info, "Date of Birth",  dob,         "Gender",         gender,     fLabel, fValue);
        doc.add(info);

        // â”€â”€ SUBJECT-WISE MARKS TABLE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        Paragraph marksHeader = new Paragraph("SUBJECT-WISE RESULT", fSection);
        marksHeader.setSpacingAfter(4);
        doc.add(marksHeader);

        // Columns: No. | Subject | [componentsâ€¦] | Total | % | Grade
        int numCols = 3 + components.size() + 3;
        float[] cw = new float[numCols];
        cw[0] = 0.4f;  // No.
        cw[1] = 2.0f;  // Subject
        for (int i = 0; i < components.size(); i++) cw[2 + i] = 0.9f;
        cw[2 + components.size()]     = 0.9f; // Total
        cw[2 + components.size() + 1] = 0.9f; // %
        cw[2 + components.size() + 2] = 0.7f; // Grade

        PdfPTable marks = new PdfPTable(numCols);
        marks.setWidthPercentage(100);
        marks.setWidths(cw);
        marks.setSpacingAfter(10);

        // Header row
        hdrCell(marks, "No.",     fColHdr, SLATE_200);
        hdrCell(marks, "Subject", fColHdr, SLATE_200);
        for (AssessmentComponent c : components) {
            String label = c.getName();
            if (c.getWeightagePercent() != null)
                label += "\n(" + c.getWeightagePercent().stripTrailingZeros().toPlainString() + "%)";
            hdrCell(marks, label, fColHdr, SLATE_200);
        }
        hdrCell(marks, "Total",  fColHdr, SLATE_200);
        hdrCell(marks, "%",      fColHdr, SLATE_200);
        hdrCell(marks, "Grade",  fColHdr, SLATE_200);

        // Data rows
        int rowNo = 1;
        BigDecimal pctSum = BigDecimal.ZERO;
        int pctCount = 0;

        for (StudentResult r : results) {
            Color bg = (rowNo % 2 == 0) ? SLATE_50 : WHITE;

            Map<Integer, StudentResultComponent> compMap = r.getComponents().stream()
                    .collect(Collectors.toMap(
                            src -> src.getAssessmentComponent().getId(),
                            src -> src,
                            (a, b) -> a));

            dataCell(marks, String.valueOf(rowNo),       fCell, bg, Element.ALIGN_CENTER);
            dataCell(marks, r.getSubject().getName(),    fCellBold, bg, Element.ALIGN_LEFT);

            for (AssessmentComponent c : components) {
                StudentResultComponent src = compMap.get(c.getId());
                String val = (src != null && src.getWeightedScore() != null)
                        ? src.getWeightedScore().setScale(1, RoundingMode.HALF_UP).toPlainString()
                        : "\u2014";
                dataCell(marks, val, fCell, bg, Element.ALIGN_CENTER);
            }

            String total = r.getTotalWeightedScore() != null
                    ? r.getTotalWeightedScore().setScale(2, RoundingMode.HALF_UP).toPlainString() : "\u2014";
            String pct = r.getPercentage() != null
                    ? r.getPercentage().setScale(1, RoundingMode.HALF_UP).toPlainString() + "%" : "\u2014";
            String grade = nonBlank(r.getGrade());

            dataCell(marks, total,  fCell,     bg, Element.ALIGN_CENTER);
            dataCell(marks, pct,    fCell,     bg, Element.ALIGN_CENTER);
            dataCell(marks, grade,  fCellBold, bg, Element.ALIGN_CENTER);

            if (r.getPercentage() != null) { pctSum = pctSum.add(r.getPercentage()); pctCount++; }
            rowNo++;
        }

        // Average footer row
        if (pctCount > 0) {
            BigDecimal avg = pctSum.divide(BigDecimal.valueOf(pctCount), 1, RoundingMode.HALF_UP);
            Color footBg = new Color(219, 234, 254); // blue-100
            dataCell(marks, "",        fCellBold, footBg, Element.ALIGN_CENTER);
            dataCell(marks, "Average", fCellBold, footBg, Element.ALIGN_LEFT);
            for (AssessmentComponent ignored : components)
                dataCell(marks, "", fCell, footBg, Element.ALIGN_CENTER);
            dataCell(marks, "",            fCell,     footBg, Element.ALIGN_CENTER);
            dataCell(marks, avg + "%",     fCellBold, footBg, Element.ALIGN_CENTER);
            dataCell(marks, "",            fCell,     footBg, Element.ALIGN_CENTER);
        }

        doc.add(marks);

        // â”€â”€ COMPONENT BREAKDOWN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        Paragraph breakdownHeader = new Paragraph("COMPONENT BREAKDOWN DETAILS", fSection);
        breakdownHeader.setSpacingAfter(4);
        doc.add(breakdownHeader);

        for (StudentResult r : results) {
            if (r.getComponents().isEmpty()) continue;

            Paragraph subP = new Paragraph(r.getSubject().getName(), fTinyBold);
            subP.setSpacingBefore(4);
            subP.setSpacingAfter(2);
            doc.add(subP);

            PdfPTable bd = new PdfPTable(5);
            bd.setWidthPercentage(100);
            bd.setWidths(new float[]{2.0f, 1.4f, 1.2f, 1.2f, 1.2f});
            bd.setSpacingAfter(5);

            hdrCell(bd, "Component",   fTinyBold, SLATE_200);
            hdrCell(bd, "Rule",        fTinyBold, SLATE_200);
            hdrCell(bd, "Raw Score",   fTinyBold, SLATE_200);
            hdrCell(bd, "Weighted",    fTinyBold, SLATE_200);
            hdrCell(bd, "Weightage",   fTinyBold, SLATE_200);

            for (StudentResultComponent src : r.getComponents()) {
                AssessmentComponent ac = src.getAssessmentComponent();
                dataCell(bd, ac.getName(),
                        fTiny, WHITE, Element.ALIGN_LEFT);
                dataCell(bd, ac.getCalculationRule().name().replace("_", " "),
                        fTiny, WHITE, Element.ALIGN_LEFT);
                String rawStr = (src.getRawScore() != null && src.getRawMax() != null)
                        ? src.getRawScore().setScale(1, RoundingMode.HALF_UP) + " / "
                          + src.getRawMax().setScale(0, RoundingMode.HALF_UP)
                        : "\u2014";
                dataCell(bd, rawStr, fTiny, WHITE, Element.ALIGN_CENTER);
                String wt = src.getWeightedScore() != null
                        ? src.getWeightedScore().setScale(2, RoundingMode.HALF_UP).toPlainString() : "\u2014";
                dataCell(bd, wt, fTiny, WHITE, Element.ALIGN_CENTER);
                String maxWt = src.getWeightagePercent() != null
                        ? src.getWeightagePercent().stripTrailingZeros().toPlainString() + "%" : "\u2014";
                dataCell(bd, maxWt, fTiny, WHITE, Element.ALIGN_CENTER);
            }
            doc.add(bd);
        }

        // â”€â”€ ATTENDANCE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        doc.add(separator());

        Paragraph attHeader = new Paragraph("ATTENDANCE SUMMARY", fSection);
        attHeader.setSpacingBefore(6);
        attHeader.setSpacingAfter(4);
        doc.add(attHeader);

        PdfPTable att = new PdfPTable(3);
        att.setWidthPercentage(55);
        att.setHorizontalAlignment(Element.ALIGN_LEFT);
        att.setWidths(new float[]{2.2f, 1.2f, 1.2f});
        att.setSpacingAfter(4);

        hdrCell(att, "Category",        fColHdr, SLATE_200);
        hdrCell(att, "Working Days",    fColHdr, SLATE_200);
        hdrCell(att, "Days Present",    fColHdr, SLATE_200);
        dataCell(att, "Overall", fCell, WHITE, Element.ALIGN_LEFT);
        dataCell(att, "\u2014",  fCell, WHITE, Element.ALIGN_CENTER);
        dataCell(att, "\u2014",  fCell, WHITE, Element.ALIGN_CENTER);
        doc.add(att);

        Paragraph attNote = new Paragraph(
                "* Detailed attendance records are maintained by the school administration.", fTiny);
        attNote.setSpacingAfter(10);
        doc.add(attNote);

        // â”€â”€ SIGNATURES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        doc.add(separator());

        PdfPTable sig = new PdfPTable(3);
        sig.setWidthPercentage(100);
        sig.setWidths(new float[]{1f, 1f, 1f});
        sig.setSpacingBefore(14);
        sig.setSpacingAfter(8);

        sigCell(sig, "Class Teacher",          fLabel);
        sigCell(sig, "Examinations In-Charge", fLabel);
        sigCell(sig, "Principal",              fLabel);
        doc.add(sig);

        // â”€â”€ FOOTER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        doc.add(separator());

        String ts = DateTimeFormatter.ofPattern("dd MMM yyyy, HH:mm 'UTC'")
                .format(Instant.now().atZone(ZoneId.of("UTC")));

        Paragraph gen = new Paragraph("Generated: " + ts, fTiny);
        gen.setAlignment(Element.ALIGN_CENTER);
        gen.setSpacingBefore(4);
        doc.add(gen);

        Paragraph note = new Paragraph(
                "This is a computer-generated report card. For queries, please contact the school administration.", fTiny);
        note.setAlignment(Element.ALIGN_CENTER);
        note.setSpacingBefore(2);
        doc.add(note);

        doc.close();
        return baos.toByteArray();
    }

    // â”€â”€ Cell helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    /** Returns a thin horizontal rule as a PdfPTable that can be added to the Document. */
    private static PdfPTable separator() {
        PdfPTable line = new PdfPTable(1);
        line.setWidthPercentage(100);
        line.setSpacingBefore(6);
        line.setSpacingAfter(6);
        PdfPCell cell = new PdfPCell(new Phrase(""));
        cell.setBorder(Rectangle.BOTTOM);
        cell.setBorderColor(SLATE_200);
        cell.setBorderWidth(0.5f);
        cell.setFixedHeight(2f);
        cell.setPadding(0);
        line.addCell(cell);
        return line;
    }

    /** Two-column key/value pair across 4 table columns. */
    private static void infoRow(PdfPTable t, String k1, String v1, String k2, String v2,
                                Font fLabel, Font fValue) {
        PdfPCell ck1 = borderlessCell(k1, fLabel);
        PdfPCell cv1 = borderlessCell(v1, fValue);
        PdfPCell ck2 = borderlessCell(k2, fLabel);
        PdfPCell cv2 = borderlessCell(v2, fValue);
        t.addCell(ck1); t.addCell(cv1); t.addCell(ck2); t.addCell(cv2);
    }

    private static PdfPCell borderlessCell(String text, Font f) {
        PdfPCell c = new PdfPCell(new Phrase(text, f));
        c.setBorder(Rectangle.NO_BORDER);
        c.setPadding(3);
        return c;
    }

    private static void hdrCell(PdfPTable t, String text, Font f, Color bg) {
        PdfPCell c = new PdfPCell(new Phrase(text, f));
        c.setBackgroundColor(bg);
        c.setHorizontalAlignment(Element.ALIGN_CENTER);
        c.setVerticalAlignment(Element.ALIGN_MIDDLE);
        c.setPadding(4);
        c.setPaddingTop(5);
        c.setPaddingBottom(5);
        t.addCell(c);
    }

    private static void dataCell(PdfPTable t, String text, Font f, Color bg, int align) {
        PdfPCell c = new PdfPCell(new Phrase(text, f));
        c.setBackgroundColor(bg);
        c.setHorizontalAlignment(align);
        c.setVerticalAlignment(Element.ALIGN_MIDDLE);
        c.setPadding(3);
        t.addCell(c);
    }

    private static void sigCell(PdfPTable t, String label, Font f) {
        PdfPCell c = new PdfPCell();
        c.setBorder(Rectangle.NO_BORDER);
        c.setPadding(8);

        // Blank line (signature area)
        Paragraph blankLine = new Paragraph("_______________________", f);
        blankLine.setAlignment(Element.ALIGN_CENTER);
        blankLine.setSpacingBefore(20);
        c.addElement(blankLine);

        Paragraph cap = new Paragraph(label, f);
        cap.setAlignment(Element.ALIGN_CENTER);
        cap.setSpacingBefore(4);
        c.addElement(cap);

        t.addCell(c);
    }

    // â”€â”€ Name builder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    private static String buildFullName(Student s) {
        StringBuilder sb = new StringBuilder();
        if (s.getFirstName() != null) sb.append(s.getFirstName());
        if (s.getMiddleName() != null && !s.getMiddleName().isBlank())
            sb.append(' ').append(s.getMiddleName());
        if (s.getLastName() != null && !s.getLastName().isBlank())
            sb.append(' ').append(s.getLastName());
        return sb.toString().trim();
    }

    private static String nonBlank(String s) {
        return (s != null && !s.isBlank()) ? s : "\u2014";
    }
}








