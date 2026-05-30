package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.performance.*;
import com.myhaimi.sms.entity.*;
import com.myhaimi.sms.repository.StudentAttendanceRepo;
import com.myhaimi.sms.repository.StudentRepo;
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

@Service
@RequiredArgsConstructor
public class StudentPerformanceService {

    private static final ZoneId REPORT_ZONE = ZoneId.systemDefault();

    private final StudentRepo studentRepo;
    private final StudentAttendanceRepo studentAttendanceRepo;

    @Transactional(readOnly = true)
    public StudentPerformanceDashboardDTO dashboard(Integer studentId) {
        return dashboard(studentId, false);
    }

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

        return new StudentPerformanceDashboardDTO(summary, attendanceTrend, overall);
    }

    private static double round2(double v) {
        return BigDecimal.valueOf(v).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }
}