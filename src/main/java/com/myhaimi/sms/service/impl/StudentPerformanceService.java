package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.performance.*;
import com.myhaimi.sms.entity.*;
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
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StudentPerformanceService {

    private static final ZoneId REPORT_ZONE = ZoneId.systemDefault();

    private final StudentRepo studentRepo;
    private final StudentAttendanceRepo studentAttendanceRepo;
    private final StudentMarkRepo studentMarkRepo;
    private final SubjectRepo subjectRepo;

    @Transactional(readOnly = true)
    public StudentPerformanceDashboardDTO dashboard(Integer studentId) {
        return dashboard(studentId, false);
    }

    /**
     * @param sinceEnrollmentOnly when true, attendance and marks are limited to on/after the student's
     *     {@link Student#getCreatedAt()} (enrollment / record creation time).
     */
    @Transactional(readOnly = true)
    public StudentPerformanceDashboardDTO dashboard(Integer studentId, boolean sinceEnrollmentOnly) {
        Integer tenantId = TenantContext.getTenantId();
        if (tenantId == null) {
            throw new IllegalStateException("Tenant context required");
        }
        Student student =
                studentRepo.findByIdAndSchool_Id(studentId, tenantId).orElseThrow(() -> new NoSuchElementException("Student not found"));

        Optional<LocalDate> since =
                sinceEnrollmentOnly && student.getCreatedAt() != null
                        ? Optional.of(LocalDate.ofInstant(student.getCreatedAt(), REPORT_ZONE))
                        : Optional.empty();

        String className = student.getClassGroup() != null ? student.getClassGroup().getDisplayName() : "—";
        String fullName = student.getFirstName() + (student.getLastName() != null ? " " + student.getLastName() : "");
        StudentPerformanceSummary summary =
                new StudentPerformanceSummary(student.getId(), student.getAdmissionNo(), fullName, className);

        List<StudentAttendance> records = studentAttendanceRepo.findByStudent_Id(studentId);
        Map<YearMonth, int[]> monthBuckets = new TreeMap<>();
        int totalSessions = 0;
        int presentSessions = 0;
        for (StudentAttendance sa : records) {
            AttendanceSession session = sa.getAttendanceSession();
            if (session == null || session.getSchool() == null || !tenantId.equals(session.getSchool().getId())) {
                continue;
            }
            LocalDate sessionDate = session.getDate();
            if (since.isPresent() && sessionDate.isBefore(since.get())) {
                continue;
            }
            YearMonth ym = YearMonth.from(sessionDate);
            int[] bucket = monthBuckets.computeIfAbsent(ym, y -> new int[] {0, 0});
            bucket[1]++;
            totalSessions++;
            if ("PRESENT".equalsIgnoreCase(sa.getStatus()) || "LATE".equalsIgnoreCase(sa.getStatus())) {
                bucket[0]++;
                presentSessions++;
            }
        }

        List<MonthlyAttendancePoint> attendanceTrend = monthBuckets.entrySet().stream()
                .map(e -> {
                    int p = e.getValue()[0];
                    int t = e.getValue()[1];
                    double pct = t == 0 ? 0 : round2(100.0 * p / t);
                    return new MonthlyAttendancePoint(e.getKey(), pct, p, t);
                })
                .toList();

        double overall = totalSessions == 0 ? 0 : round2(100.0 * presentSessions / totalSessions);

        List<StudentMark> marks = studentMarkRepo.findBySchool_IdAndStudent_IdOrderByAssessedOnAsc(tenantId, studentId);
        if (since.isPresent()) {
            LocalDate s0 = since.get();
            marks = marks.stream().filter(m -> !m.getAssessedOn().isBefore(s0)).toList();
        }
        Map<String, List<StudentMark>> bySubject =
                marks.stream().collect(Collectors.groupingBy(StudentMark::getSubjectCode, LinkedHashMap::new, Collectors.toList()));

        List<SubjectPerformanceSeries> subjectPerformance = new ArrayList<>();
        for (Map.Entry<String, List<StudentMark>> e : bySubject.entrySet()) {
            String code = e.getKey();
            String name = subjectRepo
                    .findBySchool_IdAndCode(tenantId, code)
                    .map(Subject::getName)
                    .orElse(code);
            List<MarkTrendPoint> trend = e.getValue().stream()
                    .map(m -> new MarkTrendPoint(m.getAssessedOn(), scorePercent(m.getScoreObtained(), m.getMaxScore())))
                    .toList();
            double avg = e.getValue().stream()
                    .mapToDouble(m -> scorePercent(m.getScoreObtained(), m.getMaxScore()))
                    .average()
                    .orElse(0);
            subjectPerformance.add(new SubjectPerformanceSeries(code, name, round2(avg), trend));
        }

        return new StudentPerformanceDashboardDTO(summary, attendanceTrend, subjectPerformance, overall);
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
