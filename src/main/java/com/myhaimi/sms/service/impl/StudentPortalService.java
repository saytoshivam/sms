package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.studentportal.FeeStatementDTO;
import com.myhaimi.sms.DTO.studentportal.FeeStatementLineDTO;
import com.myhaimi.sms.DTO.studentportal.StudentExamCardDTO;
import com.myhaimi.sms.DTO.studentportal.StudentMarkRowDTO;
import com.myhaimi.sms.DTO.studentportal.StudentSubjectAttendanceDTO;
import com.myhaimi.sms.DTO.timetable.PublishedStudentWeeklyTimetableDTO;
import com.myhaimi.sms.DTO.timetable.TimetableOccurrenceDTO;
import com.myhaimi.sms.entity.*;
import com.myhaimi.sms.repository.FeeInvoiceRepo;
import com.myhaimi.sms.repository.FeePaymentRepo;
import com.myhaimi.sms.repository.LectureRepo;
import com.myhaimi.sms.repository.StudentAttendanceRepo;
import com.myhaimi.sms.repository.StudentMarkRepo;
import com.myhaimi.sms.repository.StudentRepo;
import com.myhaimi.sms.repository.SubjectRepo;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class StudentPortalService {

    private static final String GREENWOOD_DEMO_SCHOOL_CODE = "greenwood-demo";

    private final StudentRepo studentRepo;
    private final PublishedTimetableCalendarService publishedTimetableCalendarService;
    private final StudentMarkRepo studentMarkRepo;
    private final SubjectRepo subjectRepo;
    private final LectureRepo lectureRepo;
    private final StudentAttendanceRepo studentAttendanceRepo;
    private final FeeInvoiceRepo feeInvoiceRepo;
    private final FeePaymentRepo feePaymentRepo;

    @Transactional(readOnly = true)
    public List<TimetableOccurrenceDTO> mySchedule(int studentId, LocalDate from, LocalDate to) {
        Integer tenantId = TenantContext.getTenantId();
        if (tenantId == null) {
            throw new IllegalStateException("Tenant context required");
        }
        Student student = studentRepo.findByIdAndSchool_Id(studentId, tenantId).orElseThrow();
        if (student.getClassGroup() == null) {
            throw new IllegalStateException("You are not assigned to a class group yet");
        }
        return publishedTimetableCalendarService.calendarForClassGroup(
                tenantId, student.getClassGroup().getId(), from, to);
    }

    @Transactional(readOnly = true)
    public PublishedStudentWeeklyTimetableDTO myWeeklyTimetable(int studentId) {
        Integer tenantId = TenantContext.getTenantId();
        if (tenantId == null) {
            throw new IllegalStateException("Tenant context required");
        }
        Student student = studentRepo.findByIdAndSchool_Id(studentId, tenantId).orElseThrow();
        if (student.getClassGroup() == null) {
            throw new IllegalStateException("You are not assigned to a class group yet");
        }
        return publishedTimetableCalendarService.studentWeeklyGrid(tenantId, student.getClassGroup().getId());
    }

    /**
     * Published exam schedule cards. Demo data for Greenwood ({@value GREENWOOD_DEMO_SCHOOL_CODE}); other schools
     * return an empty list until exam scheduling is modelled in the database.
     */
    @Transactional(readOnly = true)
    public List<StudentExamCardDTO> myExamCards(int studentId) {
        Integer tenantId = TenantContext.getTenantId();
        if (tenantId == null) {
            throw new IllegalStateException("Tenant context required");
        }
        Student student = studentRepo.findByIdAndSchool_Id(studentId, tenantId).orElseThrow();
        School school = student.getSchool();
        if (school == null || !GREENWOOD_DEMO_SCHOOL_CODE.equalsIgnoreCase(school.getCode())) {
            return List.of();
        }
        return greenwoodDemoExamCards();
    }

    private static List<StudentExamCardDTO> greenwoodDemoExamCards() {
        LocalDate today = LocalDate.now();
        LocalDate dayCbt = today.plusDays(5);
        LocalDate dayTheory = dayCbt;
        LocalDate dayPrac1 = today.plusDays(28);
        LocalDate dayPrac2 = today.plusDays(30);
        return List.of(
                new StudentExamCardDTO(
                        "COMBINED",
                        null,
                        "CBT1 of CSE101 and INT306",
                        null,
                        null,
                        "",
                        dayCbt,
                        LocalTime.of(9, 30),
                        LocalTime.of(12, 0),
                        "25-104"),
                new StudentExamCardDTO(
                        "SPLIT",
                        "ECE249",
                        "Theory End Term",
                        "(ReAppear/Improvement)",
                        "Mix MCQ + Subjective",
                        "BASIC ELECTRICAL AND ELECTRONICS ENGINEERING",
                        dayTheory,
                        LocalTime.of(13, 30),
                        LocalTime.of(16, 30),
                        "36-808"),
                new StudentExamCardDTO(
                        "SPLIT",
                        "CSE101",
                        "Practical End Term",
                        "(Regular)",
                        null,
                        "COMPUTER PROGRAMMING",
                        dayPrac1,
                        LocalTime.of(9, 30),
                        LocalTime.of(12, 30),
                        "27-401"),
                new StudentExamCardDTO(
                        "SPLIT",
                        "INT306",
                        "Practical End Term",
                        "(Regular)",
                        null,
                        "DATABASE MANAGEMENT SYSTEMS",
                        dayPrac2,
                        LocalTime.of(14, 0),
                        LocalTime.of(17, 0),
                        "37-610"));
    }

    @Transactional(readOnly = true)
    public List<StudentMarkRowDTO> myMarks(int studentId) {
        Integer tenantId = TenantContext.getTenantId();
        if (tenantId == null) {
            throw new IllegalStateException("Tenant context required");
        }
        studentRepo.findByIdAndSchool_Id(studentId, tenantId).orElseThrow();
        List<StudentMark> marks =
                studentMarkRepo.findBySchool_IdAndStudent_IdOrderByAssessedOnAsc(tenantId, studentId).stream()
                        .sorted(Comparator.comparing(StudentMark::getAssessedOn).reversed())
                        .toList();
        List<StudentMarkRowDTO> out = new ArrayList<>();
        for (StudentMark m : marks) {
            String name =
                    subjectRepo.findBySchool_IdAndCode(tenantId, m.getSubjectCode()).map(Subject::getName).orElse(m.getSubjectCode());
            double pct = scorePercent(m.getScoreObtained(), m.getMaxScore());
            out.add(new StudentMarkRowDTO(
                    m.getSubjectCode(),
                    name,
                    m.getAssessmentKey(),
                    m.getAssessmentTitle(),
                    m.getMaxScore(),
                    m.getScoreObtained(),
                    pct,
                    m.getAssessedOn(),
                    m.getTermName()));
        }
        return out;
    }

    /**
     * Subject-wise attendance for the <strong>current academic year</strong> (India-style Apr–Mar), from the first
     * day of that year up to today. Each <em>delivered</em> session is a class day that had a lecture for that subject;
     * the student’s class-level roll for that day determines present / late / excused (duty leave) / absent.
     */
    @Transactional(readOnly = true)
    public List<StudentSubjectAttendanceDTO> mySubjectAttendance(int studentId) {
        Integer tenantId = TenantContext.getTenantId();
        if (tenantId == null) {
            throw new IllegalStateException("Tenant context required");
        }
        Student student = studentRepo.findByIdAndSchool_Id(studentId, tenantId).orElseThrow();
        if (student.getClassGroup() == null) {
            return List.of();
        }
        Integer cgId = student.getClassGroup().getId();
        LocalDate today = LocalDate.now();
        LocalDate termStart = academicYearStart(today);
        LocalDate termEndInclusive = academicYearEnd(today);
        LocalDate windowEnd = today.isAfter(termEndInclusive) ? termEndInclusive : today;
        String termLabel = academicYearLabel(today);

        List<Subject> subjects = subjectRepo.findBySchool_IdAndIsDeletedFalseOrderByCodeAsc(tenantId);
        List<Lecture> lectures = lectureRepo.findBySchool_IdAndClassGroup_IdAndDateBetweenOrderByDateAscStartTimeAsc(
                tenantId, cgId, termStart, windowEnd);

        Map<String, Set<LocalDate>> lectureDatesBySubjectCode = new LinkedHashMap<>();
        Map<String, Lecture> latestLectureBySubjectCode = new HashMap<>();
        for (Lecture lec : lectures) {
            subjects.stream()
                    .filter(sub -> sub.getName().equalsIgnoreCase(lec.getSubject().trim()))
                    .findFirst()
                    .ifPresent(sub -> {
                        String code = sub.getCode();
                        lectureDatesBySubjectCode.computeIfAbsent(code, k -> new LinkedHashSet<>()).add(lec.getDate());
                        latestLectureBySubjectCode.merge(code, lec, (a, b) -> a.getDate().isBefore(b.getDate()) ? b : a);
                    });
        }

        Map<LocalDate, String> statusByDate = new HashMap<>();
        for (StudentAttendance sa : studentAttendanceRepo.findByStudent_Id(studentId)) {
            AttendanceSession session = sa.getAttendanceSession();
            if (session == null
                    || session.getSchool() == null
                    || !tenantId.equals(session.getSchool().getId())
                    || session.getClassGroup() == null
                    || !cgId.equals(session.getClassGroup().getId())) {
                continue;
            }
            LocalDate d = session.getDate();
            if (d.isBefore(termStart) || d.isAfter(windowEnd)) {
                continue;
            }
            statusByDate.put(d, sa.getStatus());
        }

        String sectionCode = student.getClassGroup().getCode();
        String rollNo = student.getAdmissionNo();
        List<StudentSubjectAttendanceDTO> out = new ArrayList<>();
        for (Subject sub : subjects) {
            Set<LocalDate> dates = lectureDatesBySubjectCode.getOrDefault(sub.getCode(), Set.of());
            if (dates.isEmpty()) {
                continue;
            }
            List<LocalDate> sortedDates = new ArrayList<>(dates);
            Collections.sort(sortedDates);

            int delivered = sortedDates.size();
            int attended = 0;
            int dutyLeaves = 0;
            LocalDate lastAttended = null;
            for (LocalDate d : sortedDates) {
                String st = statusByDate.get(d);
                if (st == null) {
                    continue;
                }
                if ("PRESENT".equalsIgnoreCase(st) || "LATE".equalsIgnoreCase(st)) {
                    attended++;
                    if (lastAttended == null || d.isAfter(lastAttended)) {
                        lastAttended = d;
                    }
                } else if ("EXCUSED".equalsIgnoreCase(st)) {
                    dutyLeaves++;
                }
            }
            double pct = delivered == 0 ? 0 : round2(100.0 * attended / delivered);
            Lecture sample = latestLectureBySubjectCode.get(sub.getCode());
            String faculty = sample != null && sample.getTeacherName() != null && !sample.getTeacherName().isBlank()
                    ? sample.getTeacherName()
                    : "—";
            String room = sample != null && sample.getRoom() != null && !sample.getRoom().isBlank()
                    ? sample.getRoom()
                    : "—";

            out.add(new StudentSubjectAttendanceDTO(
                    sub.getCode(),
                    sub.getName(),
                    attended,
                    delivered,
                    pct,
                    termLabel,
                    "(CR)",
                    "1",
                    faculty,
                    room,
                    lastAttended,
                    delivered,
                    attended,
                    dutyLeaves,
                    sectionCode,
                    rollNo));
        }
        return out;
    }

    /** First day of the academic year containing {@code d} (April 1). */
    private static LocalDate academicYearStart(LocalDate d) {
        return d.getMonthValue() >= 4 ? LocalDate.of(d.getYear(), 4, 1) : LocalDate.of(d.getYear() - 1, 4, 1);
    }

    /** Last day of the academic year containing {@code d} (March 31). */
    private static LocalDate academicYearEnd(LocalDate d) {
        return academicYearStart(d).plusYears(1).minusDays(1);
    }

    private static String academicYearLabel(LocalDate d) {
        LocalDate start = academicYearStart(d);
        return start.getYear() + "-" + (start.getYear() + 1);
    }

    /**
     * Ledger-style fee statement: invoice lines as DR (charges), payments as CR (credits). Running balance is amount
     * still owed (DR increases, CR decreases). Indian financial year Apr–Mar; filter with {@code financialYear} like
     * {@code 2025-2026}.
     */
    @Transactional(readOnly = true)
    public FeeStatementDTO myFeeStatement(int studentId, String financialYear) {
        Integer tenantId = TenantContext.getTenantId();
        if (tenantId == null) {
            throw new IllegalStateException("Tenant context required");
        }
        studentRepo.findByIdAndSchool_Id(studentId, tenantId).orElseThrow();

        List<FeeInvoice> invoices =
                feeInvoiceRepo.findBySchool_IdAndStudent_IdOrderByDueDateAscIdAsc(tenantId, studentId);

        record RawLine(LocalDateTime sortAt, LocalDate entryDate, BigDecimal amount, String drCr, String description) {}

        List<RawLine> raw = new ArrayList<>();
        Set<String> fyLabels = new TreeSet<>(Comparator.reverseOrder());

        for (FeeInvoice inv : invoices) {
            if ("VOID".equalsIgnoreCase(inv.getStatus())) {
                continue;
            }
            LocalDate due = inv.getDueDate();
            fyLabels.add(financialYearLabel(due));
            String invDesc =
                    "Fee and other charges — Invoice #" + inv.getId() + ", Status: " + inv.getStatus() + ", Due: " + due;
            raw.add(new RawLine(
                    inv.getCreatedAt() != null ? LocalDateTime.ofInstant(inv.getCreatedAt(), java.time.ZoneId.systemDefault()) : due.atStartOfDay(),
                    due,
                    inv.getAmountDue(),
                    "DR",
                    invDesc));
            for (FeePayment p : feePaymentRepo.findByInvoice_Id(inv.getId())) {
                if (!includePaymentInStatement(p)) {
                    continue;
                }
                LocalDate paid = p.getPaidAt().toLocalDate();
                fyLabels.add(financialYearLabel(paid));
                String payDesc = paymentDescription(p, inv.getId());
                raw.add(new RawLine(p.getPaidAt(), paid, p.getAmount(), "CR", payDesc));
            }
        }

        raw.sort(Comparator.comparing(RawLine::sortAt)
                .thenComparing(r -> "DR".equals(r.drCr()) ? 0 : 1)
                .thenComparing(RawLine::entryDate));

        LocalDate fyStart = null;
        LocalDate fyEnd = null;
        if (financialYear != null && !financialYear.isBlank()) {
            LocalDate[] range = parseFinancialYear(financialYear.trim());
            fyStart = range[0];
            fyEnd = range[1];
        }

        BigDecimal balance = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        List<FeeStatementLineDTO> chronological = new ArrayList<>();
        for (RawLine r : raw) {
            if (fyStart != null && (r.entryDate().isBefore(fyStart) || r.entryDate().isAfter(fyEnd))) {
                continue;
            }
            if ("DR".equals(r.drCr())) {
                balance = balance.add(r.amount());
            } else {
                balance = balance.subtract(r.amount());
            }
            balance = balance.setScale(2, RoundingMode.HALF_UP);
            chronological.add(new FeeStatementLineDTO(r.entryDate(), r.amount(), r.drCr(), r.description(), balance));
        }

        List<FeeStatementLineDTO> newestFirst = new ArrayList<>();
        for (int i = chronological.size() - 1; i >= 0; i--) {
            newestFirst.add(chronological.get(i));
        }

        if (fyLabels.isEmpty()) {
            fyLabels.add(financialYearLabel(LocalDate.now()));
        }

        return new FeeStatementDTO(new ArrayList<>(fyLabels), newestFirst);
    }

    private static boolean includePaymentInStatement(FeePayment p) {
        String gs = p.getGatewayStatus();
        return gs == null || gs.isBlank() || "SUCCEEDED".equalsIgnoreCase(gs);
    }

    private static String paymentDescription(FeePayment p, int invoiceId) {
        String method = p.getMethod() != null ? p.getMethod() : "PAYMENT";
        String ref = p.getReference() != null && !p.getReference().isBlank() ? " Ref: " + p.getReference() : "";
        return "Payment — " + method + " — Invoice #" + invoiceId + ref;
    }

    /** Financial year label for a calendar date (India: Apr–Mar), e.g. 2025-2026. */
    private static String financialYearLabel(LocalDate d) {
        int startYear = d.getMonthValue() >= 4 ? d.getYear() : d.getYear() - 1;
        return startYear + "-" + (startYear + 1);
    }

    /** Inclusive range for FY {@code 2025-2026} → 2025-04-01 .. 2026-03-31. */
    private static LocalDate[] parseFinancialYear(String fy) {
        String[] parts = fy.split("-");
        if (parts.length < 2) {
            throw new IllegalArgumentException("financialYear must look like 2025-2026");
        }
        int y1 = Integer.parseInt(parts[0].trim());
        int y2 = Integer.parseInt(parts[1].trim());
        if (y2 != y1 + 1) {
            throw new IllegalArgumentException("financialYear must span consecutive years, e.g. 2025-2026");
        }
        return new LocalDate[] {LocalDate.of(y1, 4, 1), LocalDate.of(y2, 3, 31)};
    }

    private static double scorePercent(BigDecimal obtained, BigDecimal max) {
        if (max == null || max.compareTo(BigDecimal.ZERO) <= 0) {
            return 0;
        }
        return obtained
                .multiply(BigDecimal.valueOf(100))
                .divide(max, 2, RoundingMode.HALF_UP)
                .doubleValue();
    }

    private static double round2(double v) {
        return BigDecimal.valueOf(v).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }
}
