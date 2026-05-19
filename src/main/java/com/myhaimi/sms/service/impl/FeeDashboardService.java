package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.FeeSchoolSummaryDTO;
import com.myhaimi.sms.DTO.fee.*;
import com.myhaimi.sms.entity.enums.PaymentMode;
import com.myhaimi.sms.entity.enums.StudentFeeDemandStatus;
import com.myhaimi.sms.repository.FeePaymentRepo;
import com.myhaimi.sms.repository.FeeReceiptRepository;
import com.myhaimi.sms.repository.StudentFeeDemandRepository;
import com.myhaimi.sms.repository.StudentRepo;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Provides aggregated fee KPIs (dashboard) and tabular report data.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FeeDashboardService {

    private static final Set<StudentFeeDemandStatus> OUTSTANDING_STATUSES =
            Set.of(StudentFeeDemandStatus.UNPAID, StudentFeeDemandStatus.PARTIAL);

    private final StudentFeeDemandRepository demandRepo;
    private final FeePaymentRepo paymentRepo;
    private final FeeReceiptRepository receiptRepo;
    private final StudentRepo studentRepo;

    // ─── helpers ───────────────────────────────────���──────────────────────────

    private Integer requireSchoolId() {
        Integer id = TenantContext.getTenantId();
        if (id == null) throw new IllegalStateException("Missing school context");
        return id;
    }

    private PaymentMode parseMode(String s) {
        if (s == null || s.isBlank()) return null;
        try {
            return PaymentMode.valueOf(s.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid paymentMode: " + s);
        }
    }

    // ─── Dashboard KPIs ───────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public FeeDashboardDTO getDashboard(Integer academicYearId) {
        Integer schoolId = requireSchoolId();

        BigDecimal expected = notNull(demandRepo.sumPayableAmount(schoolId, academicYearId));
        BigDecimal collected = notNull(demandRepo.sumPaidAmount(schoolId, academicYearId));
        BigDecimal outstanding = notNull(demandRepo.sumOutstanding(schoolId, OUTSTANDING_STATUSES, academicYearId));
        BigDecimal overdue = notNull(demandRepo.sumOverdue(schoolId, OUTSTANDING_STATUSES, academicYearId, LocalDate.now()));
        long studentsWithDues = demandRepo.countStudentsWithDues(schoolId, academicYearId);

        BigDecimal rate = BigDecimal.ZERO;
        if (expected.compareTo(BigDecimal.ZERO) > 0) {
            rate = collected.multiply(BigDecimal.valueOf(100))
                    .divide(expected, 2, RoundingMode.HALF_UP);
        }

        return new FeeDashboardDTO(expected, collected, outstanding, overdue, rate, studentsWithDues);
    }

    /**
     * Simplified fee KPI snapshot for the school overview (no academic year filter).
     * Used by {@link SchoolManagementService#overview()}.
     */
    @Transactional(readOnly = true)
    public FeeSchoolSummaryDTO getSchoolSummary() {
        Integer schoolId = requireSchoolId();
        BigDecimal totalInvoiced  = notNull(demandRepo.sumPayableAmount(schoolId, null));
        BigDecimal totalCollected = notNull(demandRepo.sumPaidAmount(schoolId, null));
        BigDecimal outstanding    = totalInvoiced.subtract(totalCollected);
        if (outstanding.compareTo(BigDecimal.ZERO) < 0) outstanding = BigDecimal.ZERO;
        long students       = studentRepo.countBySchool_Id(schoolId);
        long demandCount    = demandRepo.countBySchoolId(schoolId);
        long openDemandCount = demandRepo.countOpenBySchoolId(
                schoolId, List.of(StudentFeeDemandStatus.UNPAID, StudentFeeDemandStatus.PARTIAL));
        return new FeeSchoolSummaryDTO(students, totalInvoiced, totalCollected, outstanding, demandCount, openDemandCount);
    }

    // ─── Daily Collection Report ──────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<DailyCollectionRowDTO> dailyCollectionReport(
            LocalDate fromDate, LocalDate toDate, String paymentModeStr) {

        Integer schoolId = requireSchoolId();
        PaymentMode mode = parseMode(paymentModeStr);
        List<Object[]> rows = paymentRepo.dailyCollectionReport(schoolId, fromDate, toDate, mode);
        return rows.stream().map(r -> new DailyCollectionRowDTO(
                (LocalDate) r[0],
                r[1] != null ? r[1].toString() : null,
                toBD(r[2]),
                toLong(r[3])
        )).collect(Collectors.toList());
    }

    // ─── Class Outstanding Report ─────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ClassOutstandingRowDTO> classOutstandingReport(
            Integer academicYearId, Integer classGroupId, String section) {

        Integer schoolId = requireSchoolId();
        List<Object[]> rows = demandRepo.classOutstandingReport(
                schoolId, OUTSTANDING_STATUSES, academicYearId, classGroupId,
                (section != null && section.isBlank()) ? null : section);
        return rows.stream().map(r -> new ClassOutstandingRowDTO(
                (Integer) r[0],
                (String)  r[1],
                (String)  r[2],
                toLong(r[3]),
                toLong(r[4]),
                toBD(r[5]),
                toBD(r[6]),
                toBD(r[7])
        )).collect(Collectors.toList());
    }

    // ─── Student Due Report ───────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<StudentDueRowDTO> studentDueReport(
            Integer academicYearId, Integer classGroupId, String section) {

        Integer schoolId = requireSchoolId();
        List<Object[]> rows = demandRepo.studentDueReport(
                schoolId, academicYearId, classGroupId,
                (section != null && section.isBlank()) ? null : section);
        return rows.stream().map(r -> {
            String firstName = (String) r[1];
            String lastName  = (String) r[2];
            String name      = firstName + (lastName != null ? " " + lastName : "");
            return new StudentDueRowDTO(
                    (Integer) r[0],
                    name,
                    (String)  r[3],
                    (String)  r[4],
                    toBD(r[5]),
                    toBD(r[6]),
                    toBD(r[7])
            );
        }).collect(Collectors.toList());
    }

    // ─── Payment Mode Report ──────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<PaymentModeRowDTO> paymentModeReport(LocalDate fromDate, LocalDate toDate) {
        Integer schoolId = requireSchoolId();
        List<Object[]> rows = paymentRepo.paymentModeReport(schoolId, fromDate, toDate);
        return rows.stream().map(r -> new PaymentModeRowDTO(
                r[0] != null ? r[0].toString() : null,
                toBD(r[1]),
                toLong(r[2])
        )).collect(Collectors.toList());
    }

    // ─── Receipt Register ─────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ReceiptRegisterRowDTO> receiptRegister(
            LocalDate fromDate, LocalDate toDate, String paymentModeStr, Integer studentId) {

        Integer schoolId = requireSchoolId();
        PaymentMode mode = parseMode(paymentModeStr);
        List<Object[]> rows = receiptRepo.receiptRegister(schoolId, fromDate, toDate, mode, studentId);
        return rows.stream().map(r -> {
            String firstName = (String) r[4];
            String lastName  = (String) r[5];
            String name      = firstName + (lastName != null ? " " + lastName : "");
            return new ReceiptRegisterRowDTO(
                    toLong2(r[14]),          // paymentId
                    toLong2(r[0]),           // receiptId
                    (String)  r[1],          // receiptNo
                    (LocalDate) r[2],        // paymentDate
                    (Integer)  r[3],         // studentId
                    name,                    // studentName
                    (String)  r[6],          // admissionNo
                    (String)  r[7],          // className (may be null)
                    toBD(r[8]),              // amount
                    r[9] != null ? r[9].toString() : null,  // paymentMode
                    (String)  r[10],         // referenceNo
                    r[11] != null ? r[11].toString() : null, // status
                    (Instant) r[12],         // issuedAt
                    (Instant) r[13]          // cancelledAt
            );
        }).collect(Collectors.toList());
    }

    // ─── CSV Export helpers ───────────────────────────────────────────────────

    public String toDailyCsv(List<DailyCollectionRowDTO> rows) {
        StringBuilder sb = new StringBuilder("Date,Payment Mode,Total Amount,Payment Count\n");
        for (DailyCollectionRowDTO r : rows) {
            sb.append(csv(r.getPaymentDate())).append(',')
              .append(csv(r.getPaymentMode())).append(',')
              .append(csv(r.getTotalAmount())).append(',')
              .append(r.getPaymentCount()).append('\n');
        }
        return sb.toString();
    }

    public String toClassOutstandingCsv(List<ClassOutstandingRowDTO> rows) {
        StringBuilder sb = new StringBuilder("Class,Section,Students,Demands,Total Payable,Total Paid,Outstanding\n");
        for (ClassOutstandingRowDTO r : rows) {
            sb.append(csv(r.getClassName())).append(',')
              .append(csv(r.getSection())).append(',')
              .append(r.getStudentCount()).append(',')
              .append(r.getDemandCount()).append(',')
              .append(csv(r.getTotalPayable())).append(',')
              .append(csv(r.getTotalPaid())).append(',')
              .append(csv(r.getTotalOutstanding())).append('\n');
        }
        return sb.toString();
    }

    public String toStudentDueCsv(List<StudentDueRowDTO> rows) {
        StringBuilder sb = new StringBuilder("Student ID,Name,Admission No,Class,Total Payable,Total Paid,Balance\n");
        for (StudentDueRowDTO r : rows) {
            sb.append(r.getStudentId()).append(',')
              .append(csv(r.getStudentName())).append(',')
              .append(csv(r.getAdmissionNo())).append(',')
              .append(csv(r.getClassName())).append(',')
              .append(csv(r.getTotalPayable())).append(',')
              .append(csv(r.getTotalPaid())).append(',')
              .append(csv(r.getTotalBalance())).append('\n');
        }
        return sb.toString();
    }

    public String toPaymentModeCsv(List<PaymentModeRowDTO> rows) {
        StringBuilder sb = new StringBuilder("Payment Mode,Total Amount,Payment Count\n");
        for (PaymentModeRowDTO r : rows) {
            sb.append(csv(r.getPaymentMode())).append(',')
              .append(csv(r.getTotalAmount())).append(',')
              .append(r.getPaymentCount()).append('\n');
        }
        return sb.toString();
    }

    public String toReceiptRegisterCsv(List<ReceiptRegisterRowDTO> rows) {
        StringBuilder sb = new StringBuilder("Receipt No,Date,Student,Admission No,Class,Amount,Mode,Reference,Status,Issued At\n");
        for (ReceiptRegisterRowDTO r : rows) {
            sb.append(csv(r.getReceiptNo())).append(',')
              .append(csv(r.getPaymentDate())).append(',')
              .append(csv(r.getStudentName())).append(',')
              .append(csv(r.getAdmissionNo())).append(',')
              .append(csv(r.getClassName())).append(',')
              .append(csv(r.getAmount())).append(',')
              .append(csv(r.getPaymentMode())).append(',')
              .append(csv(r.getReferenceNo())).append(',')
              .append(csv(r.getStatus())).append(',')
              .append(csv(r.getIssuedAt())).append('\n');
        }
        return sb.toString();
    }

    // ─── util ─────────────────────────────────────────────────────────────────

    private static BigDecimal notNull(BigDecimal v) {
        return v != null ? v : BigDecimal.ZERO;
    }

    private static BigDecimal toBD(Object v) {
        if (v == null) return BigDecimal.ZERO;
        if (v instanceof BigDecimal bd) return bd;
        return new BigDecimal(v.toString());
    }

    private static long toLong(Object v) {
        if (v == null) return 0L;
        if (v instanceof Number n) return n.longValue();
        return Long.parseLong(v.toString());
    }

    private static Long toLong2(Object v) {
        if (v == null) return null;
        if (v instanceof Number n) return n.longValue();
        return Long.parseLong(v.toString());
    }

    private static String csv(Object v) {
        if (v == null) return "";
        String s = v.toString();
        if (s.contains(",") || s.contains("\"") || s.contains("\n")) {
            return "\"" + s.replace("\"", "\"\"") + "\"";
        }
        return s;
    }
}

