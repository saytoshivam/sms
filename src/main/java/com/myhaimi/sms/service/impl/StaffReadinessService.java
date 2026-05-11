package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.staff.StaffReadinessDashboardDTO;
import com.myhaimi.sms.DTO.staff.StaffReadinessIssueDTO;
import com.myhaimi.sms.DTO.staff.StaffReadinessSummaryDTO;
import com.myhaimi.sms.entity.*;
import com.myhaimi.sms.entity.enums.StaffStatus;
import com.myhaimi.sms.entity.enums.StaffType;
import com.myhaimi.sms.entity.enums.StudentDocumentCollectionStatus;
import com.myhaimi.sms.repository.*;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Computes the Staff / Teacher Onboarding Readiness dashboard.
 * <p>
 * All data is loaded in a small number of bulk queries (no N+1 per staff member)
 * and then processed in-memory. The result is intentionally read-only.
 * </p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StaffReadinessService {

    private final StaffRepo                        staffRepo;
    private final StaffTeachableSubjectRepository  teachableSubjectRepo;
    private final UserRepo                         userRepo;
    private final SubjectAllocationRepo            allocationRepo;
    private final StaffDocumentRepo                documentRepo;

    // ── Public API ────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public StaffReadinessDashboardDTO build() {
        Integer schoolId = requireSchoolId();

        // ── 1. Load all non-deleted staff ────────────────────────────────────
        List<Staff> allStaff = staffRepo.findBySchool_IdAndIsDeletedFalseOrderByEmployeeNoAsc(schoolId);

        // ── 2. Teachable-subjects map  (staffId → has ≥1 subject) ───────────
        Set<Integer> staffIdsWithSubjects =
                teachableSubjectRepo.findByStaff_School_Id(schoolId)
                        .stream()
                        .map(s -> s.getStaff().getId())
                        .collect(Collectors.toSet());

        // ── 3. Login map  (staffId → User) ───────────────────────────────────
        Map<Integer, User> userByStaffId = new HashMap<>();
        for (User u : userRepo.findBySchool_IdWithProfilesOrderByEmailAsc(schoolId)) {
            if (u.getLinkedStaff() != null) {
                userByStaffId.put(u.getLinkedStaff().getId(), u);
            }
        }

        // ── 4. Allocated weekly load map  (staffId → periods/week) ───────────
        Map<Integer, Integer> loadByStaffId = new HashMap<>();
        for (SubjectAllocation alloc : allocationRepo.findBySchool_Id(schoolId)) {
            if (alloc.getStaff() != null) {
                loadByStaffId.merge(alloc.getStaff().getId(), alloc.getWeeklyFrequency(), Integer::sum);
            }
        }

        // ── 5. Documents map  (staffId → pending doc count) ──────────────────
        Map<Integer, Long> pendingDocCountByStaffId = new HashMap<>();
        for (StaffDocument doc : documentRepo.findByStaff_School_Id(schoolId)) {
            if (doc.getCollectionStatus() == StudentDocumentCollectionStatus.PENDING_COLLECTION) {
                pendingDocCountByStaffId.merge(doc.getStaff().getId(), 1L, Long::sum);
            }
        }

        // ── 6. Build queues and summary counters ──────────────────────────────
        List<StaffReadinessIssueDTO> missingSubjects      = new ArrayList<>();
        List<StaffReadinessIssueDTO> missingLogin         = new ArrayList<>();
        List<StaffReadinessIssueDTO> missingDocuments     = new ArrayList<>();
        List<StaffReadinessIssueDTO> missingJoiningDate   = new ArrayList<>();
        List<StaffReadinessIssueDTO> overCapacity         = new ArrayList<>();
        List<StaffReadinessIssueDTO> notTimetableEligible = new ArrayList<>();

        int totalStaff               = allStaff.size();
        int activeTeachers           = 0;
        int timetableEligible        = 0;
        int teacherMissingSubjectsC  = 0;
        int staffMissingLoginC       = 0;
        int staffDocsPendingC        = 0;
        int overloadedC              = 0;

        for (Staff staff : allStaff) {
            int    staffId       = staff.getId();
            String staffName     = staff.getFullName();
            String employeeNo    = staff.getEmployeeNo();
            boolean isTeaching   = staff.getStaffType() == StaffType.TEACHING;
            boolean isActive     = staff.getStatus() == StaffStatus.ACTIVE;

            User    user         = userByStaffId.get(staffId);
            boolean hasLogin     = user != null;
            boolean hasTeacherRole = hasLogin && user.getRoles() != null &&
                    user.getRoles().stream().anyMatch(r -> "TEACHER".equals(r.getName()));

            boolean hasSubjects        = staffIdsWithSubjects.contains(staffId);
            boolean isTimetableReady   = isTeaching && hasTeacherRole && hasSubjects;

            int     assignedLoad = loadByStaffId.getOrDefault(staffId, 0);
            int     maxLoad      = staff.getMaxWeeklyLectureLoad() != null ? staff.getMaxWeeklyLectureLoad() : 0;
            boolean isOverloaded = maxLoad > 0 && assignedLoad > maxLoad;

            long    pendingDocs  = pendingDocCountByStaffId.getOrDefault(staffId, 0L);
            boolean hasPending   = pendingDocs > 0;

            // ── Summary counters ─────────────────────────────────────────────
            if (isTeaching && isActive) activeTeachers++;
            if (isTimetableReady)       timetableEligible++;
            if (isTeaching && !hasSubjects) teacherMissingSubjectsC++;
            if (!hasLogin)              staffMissingLoginC++;
            if (hasPending)             staffDocsPendingC++;
            if (isOverloaded)           overloadedC++;

            // ── Queue: missing teachable subjects ────────────────────────────
            if (isTeaching && !hasSubjects) {
                missingSubjects.add(issue(staffId, staffName, employeeNo,
                        "No teachable subjects assigned",
                        "Cannot be auto-assigned to timetable",
                        List.of("OPEN_PROFILE", "ASSIGN_SUBJECTS")));
            }

            // ── Queue: missing login ─────────────────────────────────────────
            if (!hasLogin) {
                missingLogin.add(issue(staffId, staffName, employeeNo,
                        "Login account not created",
                        "Cannot view teacher dashboard or portal",
                        List.of("OPEN_PROFILE", "CREATE_LOGIN")));
            }

            // ── Queue: missing documents ─────────────────────────────────────
            if (hasPending) {
                missingDocuments.add(issue(staffId, staffName, employeeNo,
                        pendingDocs + " document(s) pending collection",
                        "HR records incomplete; may be required for regulatory compliance",
                        List.of("OPEN_PROFILE", "MARK_DOCUMENTS_COLLECTED")));
            }

            // ── Queue: missing joining date ──────────────────────────────────
            if (staff.getJoiningDate() == null) {
                missingJoiningDate.add(issue(staffId, staffName, employeeNo,
                        "Joining date not recorded",
                        "Accurate service length and attendance tracking unavailable",
                        List.of("OPEN_PROFILE")));
            }

            // ── Queue: over capacity ─────────────────────────────────────────
            if (isOverloaded) {
                overCapacity.add(issue(staffId, staffName, employeeNo,
                        "Load " + assignedLoad + "/" + maxLoad + " periods — overloaded",
                        "Over-scheduled; timetable quality and teacher well-being affected",
                        List.of("OPEN_PROFILE", "SET_LOAD")));
            }

            // ── Queue: not timetable eligible ────────────────────────────────
            if (isTeaching && !isTimetableReady) {
                String reason = !hasTeacherRole
                        ? (!hasLogin ? "No login / TEACHER role" : "Missing TEACHER role")
                        : "No teachable subjects";
                notTimetableEligible.add(issue(staffId, staffName, employeeNo,
                        reason,
                        "Cannot be placed on timetable — schedule will have gaps",
                        List.of("OPEN_PROFILE", "ASSIGN_SUBJECTS")));
            }
        }

        StaffReadinessSummaryDTO summary = StaffReadinessSummaryDTO.builder()
                .totalStaff(totalStaff)
                .activeTeachers(activeTeachers)
                .timetableEligibleTeachers(timetableEligible)
                .teachersMissingSubjects(teacherMissingSubjectsC)
                .staffMissingLogin(staffMissingLoginC)
                .staffDocumentsPending(staffDocsPendingC)
                .overloadedTeachers(overloadedC)
                .build();

        return StaffReadinessDashboardDTO.builder()
                .summary(summary)
                .missingSubjects(missingSubjects)
                .missingLogin(missingLogin)
                .missingDocuments(missingDocuments)
                .missingJoiningDate(missingJoiningDate)
                .overCapacity(overCapacity)
                .notTimetableEligible(notTimetableEligible)
                .build();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static StaffReadinessIssueDTO issue(int staffId, String name, String empNo,
                                                 String issue, String impact, List<String> actions) {
        return StaffReadinessIssueDTO.builder()
                .staffId(staffId)
                .staffName(name)
                .employeeNo(empNo)
                .issue(issue)
                .impact(impact)
                .actions(actions)
                .build();
    }

    private Integer requireSchoolId() {
        Integer id = TenantContext.getTenantId();
        if (id == null) throw new IllegalStateException("Missing school context");
        return id;
    }
}

