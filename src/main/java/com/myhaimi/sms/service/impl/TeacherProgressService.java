package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.teacher.TeacherStudentProgressRowDTO;
import com.myhaimi.sms.entity.*;
import com.myhaimi.sms.repository.StudentAttendanceRepo;
import com.myhaimi.sms.repository.StudentMarkRepo;
import com.myhaimi.sms.repository.StudentRepo;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TeacherProgressService {

    private static final ZoneId REPORT_ZONE = ZoneId.systemDefault();

    private final StudentRepo studentRepo;
    private final StudentAttendanceRepo studentAttendanceRepo;
    private final StudentMarkRepo studentMarkRepo;

    @Transactional(readOnly = true)
    public List<TeacherStudentProgressRowDTO> studentProgressSinceEnrollment() {
        Integer tenantId = TenantContext.getTenantId();
        if (tenantId == null) {
            throw new IllegalStateException("Tenant context required");
        }
        List<Student> students = studentRepo.findBySchool_IdOrderByLastNameAscFirstNameAsc(tenantId);
        if (students.isEmpty()) {
            return List.of();
        }
        List<Integer> ids = students.stream().map(Student::getId).toList();
        Map<Integer, List<StudentAttendance>> attByStudent =
                studentAttendanceRepo.findByStudent_IdIn(ids).stream().collect(Collectors.groupingBy(a -> a.getStudent().getId()));
        Map<Integer, List<StudentMark>> marksByStudent =
                studentMarkRepo.findBySchool_IdAndStudent_IdIn(tenantId, ids).stream()
                        .collect(Collectors.groupingBy(m -> m.getStudent().getId()));

        List<TeacherStudentProgressRowDTO> rows = new ArrayList<>();
        for (Student st : students) {
            LocalDate joined =
                    st.getCreatedAt() != null
                            ? LocalDate.ofInstant(st.getCreatedAt(), REPORT_ZONE)
                            : LocalDate.now();
            List<StudentAttendance> att = attByStudent.getOrDefault(st.getId(), List.of());
            int total = 0;
            int present = 0;
            for (StudentAttendance sa : att) {
                AttendanceSession session = sa.getAttendanceSession();
                if (session == null
                        || session.getSchool() == null
                        || !tenantId.equals(session.getSchool().getId())) {
                    continue;
                }
                LocalDate d = session.getDate();
                if (d.isBefore(joined)) {
                    continue;
                }
                total++;
                if ("PRESENT".equalsIgnoreCase(sa.getStatus()) || "LATE".equalsIgnoreCase(sa.getStatus())) {
                    present++;
                }
            }
            double attPct = total == 0 ? 0 : round2(100.0 * present / total);

            List<StudentMark> marks =
                    marksByStudent.getOrDefault(st.getId(), List.of()).stream()
                            .filter(m -> !m.getAssessedOn().isBefore(joined))
                            .toList();
            double avgScore =
                    marks.isEmpty()
                            ? 0
                            : round2(
                                    marks.stream()
                                            .mapToDouble(m -> scorePercent(m.getScoreObtained(), m.getMaxScore()))
                                            .average()
                                            .orElse(0));

            String className = st.getClassGroup() != null ? st.getClassGroup().getDisplayName() : "—";
            String fullName = st.getFirstName() + (st.getLastName() != null ? " " + st.getLastName() : "");
            rows.add(new TeacherStudentProgressRowDTO(
                    st.getId(),
                    st.getAdmissionNo(),
                    fullName,
                    className,
                    joined,
                    attPct,
                    avgScore,
                    marks.size()));
        }
        return rows;
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
