package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.teacher.TeacherStudentProgressRowDTO;
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
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TeacherProgressService {

    private static final ZoneId REPORT_ZONE = ZoneId.systemDefault();

    private final StudentRepo studentRepo;
    private final StudentAttendanceRepo studentAttendanceRepo;

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
                studentAttendanceRepo.findByStudent_IdIn(ids).stream()
                        .collect(Collectors.groupingBy(a -> a.getStudent().getId()));

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

            String className = st.getClassGroup() != null ? st.getClassGroup().getDisplayName() : "—";
            String fullName = st.getFirstName() + (st.getLastName() != null ? " " + st.getLastName() : "");
            // averageScorePercent and marksCount are 0 — legacy marks removed; new exam module coming
            rows.add(new TeacherStudentProgressRowDTO(
                    st.getId(),
                    st.getAdmissionNo(),
                    fullName,
                    className,
                    joined,
                    attPct,
                    0,
                    0));
        }
        return rows;
    }

    private static double round2(double v) {
        return BigDecimal.valueOf(v).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }
}
