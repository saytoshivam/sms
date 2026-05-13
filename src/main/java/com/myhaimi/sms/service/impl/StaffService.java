package com.myhaimi.sms.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.myhaimi.sms.DTO.staff.StaffProfileDTO;
import com.myhaimi.sms.DTO.staff.StaffSummaryDTO;
import com.myhaimi.sms.entity.School;
import com.myhaimi.sms.entity.Staff;
import com.myhaimi.sms.entity.enums.StaffStatus;
import com.myhaimi.sms.entity.enums.StaffType;
import com.myhaimi.sms.repository.SchoolRepo;
import com.myhaimi.sms.repository.StaffRepo;
import com.myhaimi.sms.repository.StaffTeachableSubjectRepository;
import com.myhaimi.sms.repository.UserRepo;
import com.myhaimi.sms.entity.Role;
import com.myhaimi.sms.entity.StaffTeachableSubject;
import com.myhaimi.sms.entity.User;
import com.myhaimi.sms.security.RoleNames;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class StaffService {

    private static final TypeReference<List<Integer>> INT_LIST    = new TypeReference<>() {};
    private static final TypeReference<List<String>>  STRING_LIST = new TypeReference<>() {};

    private final StaffRepo                     staffRepo;
    private final SchoolRepo                    schoolRepo;
    private final UserRepo                      userRepo;
    private final StaffTeachableSubjectRepository staffTeachableSubjectRepository;
    private final ObjectMapper                  objectMapper;

    // ── Tenant helper ──────────────────────────────────────────────────────────

    private Integer requireSchoolId() {
        Integer schoolId = TenantContext.getSchoolId();
        if (schoolId == null) throw new IllegalStateException("Missing school context");
        return schoolId;
    }

    // ── List (page) ────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Page<StaffSummaryDTO> list(Pageable pageable) {
        Integer schoolId = requireSchoolId();
        Page<Staff> page = staffRepo.findBySchool_IdAndIsDeletedFalse(schoolId, pageable);

        Map<Integer, List<String>> rolesByStaff    = buildRolesMap(schoolId);
        Map<Integer, List<String>> subjectsByStaff = buildSubjectsMap(schoolId);
        Map<Integer, User>         loginByStaff    = buildLoginMap(schoolId);
        Integer schoolDefaultLoad = schoolDefaultWeeklyLoad(schoolId);

        List<StaffSummaryDTO> dtos = page.getContent().stream()
                .map(s -> toSummaryDTO(s, rolesByStaff, subjectsByStaff, loginByStaff, schoolDefaultLoad))
                .toList();

        return new PageImpl<>(dtos, pageable, page.getTotalElements());
    }

    // ── Detail ─────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public StaffProfileDTO getById(Integer staffId) {
        Integer schoolId = requireSchoolId();
        Staff staff = staffRepo.findByIdAndSchool_IdAndIsDeletedFalse(staffId, schoolId)
                .orElseThrow(() -> new IllegalArgumentException("Staff not found."));

        Map<Integer, List<String>> rolesByStaff    = buildRolesMap(schoolId);
        Map<Integer, List<String>> subjectsByStaff = buildSubjectsMap(schoolId);
        Map<Integer, User>         loginByStaff    = buildLoginMap(schoolId);
        Integer schoolDefaultLoad = schoolDefaultWeeklyLoad(schoolId);

        return toProfileDTO(staff, rolesByStaff, subjectsByStaff, loginByStaff, schoolDefaultLoad);
    }

    // ── Create (legacy — internal only; controller POST is disabled / returns 410) ──

    /**
     * @deprecated Internal use only — no controller exposes this method any longer.
     *             Use {@code SchoolOnboardingService#onboardStaff} instead.
     */
    @Deprecated
    @Transactional
    StaffSummaryDTO create(Staff staff) {
        Integer schoolId = requireSchoolId();
        School school = schoolRepo.findById(schoolId).orElseThrow();
        staff.setId(null);
        staff.setSchool(school);
        if (staff.getStaffType() == null) staff.setStaffType(StaffType.TEACHING);
        if (staff.getStatus() == null)    staff.setStatus(StaffStatus.DRAFT);
        Staff saved = staffRepo.save(staff);
        return toSummaryDTO(saved, Map.of(), Map.of(), Map.of(), null);
    }

    // ── Mapping helpers ────────────────────────────────────────────────────────

    /**
     * Builds a staffId → List&lt;String&gt; roleName map from linked User records.
     * Used as a <em>fallback</em> when {@code Staff.staffRolesJson} is not yet populated
     * (backward-compatibility for records created before the staff role migration).
     */
    private Map<Integer, List<String>> buildRolesMap(Integer schoolId) {
        Map<Integer, List<String>> map = new HashMap<>();
        for (User u : userRepo.findBySchool_IdWithProfilesOrderByEmailAsc(schoolId)) {
            if (u.getLinkedStaff() == null || u.getLinkedStaff().getId() == null) continue;
            map.put(u.getLinkedStaff().getId(),
                    u.getRoles().stream().map(Role::getName).sorted().toList());
        }
        return map;
    }

    private Map<Integer, List<String>> buildSubjectsMap(Integer schoolId) {
        Map<Integer, List<String>> map = new HashMap<>();
        for (StaffTeachableSubject st : staffTeachableSubjectRepository.findByStaff_School_Id(schoolId)) {
            if (st.getStaff() == null || st.getSubject() == null) continue;
            map.computeIfAbsent(st.getStaff().getId(), k -> new ArrayList<>())
               .add(st.getSubject().getCode());
        }
        map.values().forEach(list -> list.sort(String::compareToIgnoreCase));
        return map;
    }

    private Map<Integer, User> buildLoginMap(Integer schoolId) {
        Map<Integer, User> map = new HashMap<>();
        for (User u : userRepo.findBySchool_IdWithProfilesOrderByEmailAsc(schoolId)) {
            if (u.getLinkedStaff() == null || u.getLinkedStaff().getId() == null) continue;
            map.put(u.getLinkedStaff().getId(), u);
        }
        return map;
    }

    private Integer schoolDefaultWeeklyLoad(Integer schoolId) {
        return schoolRepo.findById(schoolId)
                .map(School::getDefaultTeacherWeeklyLoad)
                .orElse(null);
    }

    private List<Integer> parseIntListJson(String json) {
        if (json == null || json.isBlank()) return List.of();
        try { return objectMapper.readValue(json, INT_LIST); } catch (Exception e) { return List.of(); }
    }

    private List<String> parseStringListJson(String json) {
        if (json == null || json.isBlank()) return List.of();
        try { return objectMapper.readValue(json, STRING_LIST); } catch (Exception e) { return List.of(); }
    }

    /** Populate the summary fields shared between Summary and Profile DTOs. */
    private void fillSummary(StaffSummaryDTO dto, Staff s,
                             Map<Integer, List<String>> rolesMap,
                             Map<Integer, List<String>> subjectsMap,
                             Map<Integer, User> loginMap,
                             Integer schoolDefaultWeeklyLoad) {
        dto.setId(s.getId());
        dto.setEmployeeNo(s.getEmployeeNo());
        dto.setFullName(s.getFullName());
        dto.setDesignation(s.getDesignation());
        dto.setPhone(s.getPhone());
        dto.setEmail(s.getEmail());
        dto.setPhotoUrl(s.getPhotoUrl());
        dto.setStaffType(s.getStaffType());
        dto.setStatus(s.getStatus());
        dto.setEmploymentType(s.getEmploymentType());
        dto.setDepartment(s.getDepartment());
        dto.setJoiningDate(s.getJoiningDate());
        dto.setSpecialization(s.getSpecialization());
        dto.setYearsOfExperience(s.getYearsOfExperience());
        dto.setMaxWeeklyLectureLoad(s.getMaxWeeklyLectureLoad());
        dto.setMaxDailyLectureLoad(s.getMaxDailyLectureLoad());
        dto.setCanBeClassTeacher(s.isCanBeClassTeacher());
        dto.setCanTakeSubstitution(s.isCanTakeSubstitution());
        dto.setPreferredClassGroupIds(parseIntListJson(s.getPreferredClassGroupIdsJson()));
        dto.setRestrictedClassGroupIds(parseIntListJson(s.getRestrictedClassGroupIdsJson()));

        // ── Roles: staffRolesJson is the authoritative source; fall back to User.roles
        //    for records that pre-date the migration.
        List<String> staffOwnRoles = parseStringListJson(s.getStaffRolesJson());
        List<String> roles = staffOwnRoles.isEmpty()
                ? rolesMap.getOrDefault(s.getId(), List.of())
                : staffOwnRoles;

        List<String> subjects = subjectsMap.getOrDefault(s.getId(), List.of());
        User         user     = loginMap.get(s.getId());

        dto.setRoles(roles);
        dto.setTeachableSubjectCodes(subjects);
        dto.setHasLoginAccount(user != null);
        dto.setUserId(user != null ? user.getId() : null);
        dto.setUsername(user != null ? user.getUsername() : null);
        dto.setLastInviteSentAt(user != null ? user.getLastInviteSentAt() : null);

        // loginStatus: NOT_CREATED → INVITED → ACTIVE / DISABLED
        if (user == null) {
            dto.setLoginStatus("NOT_CREATED");
        } else if (user.isInvitePending()) {
            dto.setLoginStatus("INVITED");
        } else {
            dto.setLoginStatus(user.isEnabled() ? "ACTIVE" : "DISABLED");
        }

        // ── Timetable eligibility ──────────────────────────────────────────────
        boolean isActive       = s.getStatus() == StaffStatus.ACTIVE;
        boolean isTeaching     = s.getStaffType() == StaffType.TEACHING;
        boolean hasTeacherRole = roles.stream().anyMatch(r -> RoleNames.TEACHER.equalsIgnoreCase(r));
        boolean hasSubjects    = !subjects.isEmpty();
        boolean hasLoadCap     = s.getMaxWeeklyLectureLoad() != null || schoolDefaultWeeklyLoad != null;

        List<String> ineligReasons = computeIneligibilityReasons(
                isActive, isTeaching, hasTeacherRole, hasSubjects, hasLoadCap);
        dto.setTimetableEligible(ineligReasons.isEmpty());
        dto.setTimetableEligibilityReasons(ineligReasons);

        dto.setMissingRequiredItems(computeMissingItems(s, roles, subjects, schoolDefaultWeeklyLoad));
        dto.setCreatedAt(s.getCreatedAt());
        dto.setUpdatedAt(s.getUpdatedAt());
    }

    // ── Computed helpers ───────────────────────────────────────────────────────

    /**
     * Returns human-readable reasons why a staff member is not timetable eligible.
     * An empty list means the staff IS eligible.
     */
    public static List<String> computeIneligibilityReasons(
            boolean isActive, boolean isTeaching, boolean hasTeacherRole,
            boolean hasSubjects, boolean hasLoadCapacity) {
        List<String> r = new ArrayList<>();
        if (!isActive)       r.add("Staff not ACTIVE");
        if (!isTeaching)     r.add("Not TEACHING staff type");
        if (!hasTeacherRole) r.add("No TEACHER role");
        if (!hasSubjects)    r.add("No teachable subjects");
        if (!hasLoadCapacity)r.add("No max weekly lecture load (set on staff or school default)");
        return r;
    }

    /**
     * Backward-compatible overload that omits the load-capacity check.
     * @deprecated Use {@link #computeIneligibilityReasons(boolean, boolean, boolean, boolean, boolean)}.
     */
    @Deprecated
    public static List<String> computeIneligibilityReasons(
            boolean isActive, boolean isTeaching, boolean hasTeacherRole, boolean hasSubjects) {
        return computeIneligibilityReasons(isActive, isTeaching, hasTeacherRole, hasSubjects, true);
    }

    private List<String> computeMissingItems(Staff s, List<String> roles, List<String> subjects,
                                              Integer schoolDefaultWeeklyLoad) {
        List<String> missing = new ArrayList<>();
        if (s.getDesignation() == null || s.getDesignation().isBlank())
            missing.add("Designation is required.");
        if (s.getStaffType() == null)
            missing.add("Staff type is required.");
        if (roles.isEmpty())
            missing.add("At least one role must be assigned.");
        if (s.getJoiningDate() == null && s.getStatus() == StaffStatus.ACTIVE)
            missing.add("Joining date is required before staff can be activated.");
        if (s.getStaffType() == StaffType.TEACHING) {
            boolean hasTeacherRole = roles.stream().anyMatch(r -> RoleNames.TEACHER.equalsIgnoreCase(r));
            if (!hasTeacherRole) {
                missing.add("TEACHER role is recommended for TEACHING staff to enable timetable assignment.");
            } else {
                if (subjects.isEmpty())
                    missing.add("At least one teachable subject is required for timetable eligibility.");
                if (s.getMaxWeeklyLectureLoad() == null && schoolDefaultWeeklyLoad == null)
                    missing.add("Max weekly lecture load is required for timetable eligibility (set here or configure a school default).");
            }
        }
        if (s.getEmail() == null || s.getEmail().isBlank())
            missing.add("Email is required to enable login account.");
        return missing;
    }

    private StaffProfileDTO.ProfileCompleteness computeProfileCompleteness(Staff s) {
        record Section(String name, boolean filled) {}
        List<Section> sections = List.of(
                new Section("Contact & Address",
                        s.getCurrentAddressLine1() != null && !s.getCurrentAddressLine1().isBlank()),
                new Section("Emergency Contact",
                        s.getEmergencyContactName() != null && !s.getEmergencyContactName().isBlank()),
                new Section("Qualification",
                        s.getHighestQualification() != null && !s.getHighestQualification().isBlank()),
                new Section("Payroll Setup",
                        s.isPayrollEnabled() || (s.getBankAccountNumber() != null && !s.getBankAccountNumber().isBlank())),
                new Section("Joining Date",
                        s.getJoiningDate() != null),
                new Section("Department",
                        s.getDepartment() != null && !s.getDepartment().isBlank())
        );

        int filled = (int) sections.stream().filter(Section::filled).count();
        int total  = sections.size();
        int pct    = total == 0 ? 100 : (filled * 100 / total);
        List<String> empty = sections.stream()
                .filter(sec -> !sec.filled())
                .map(Section::name)
                .toList();

        return new StaffProfileDTO.ProfileCompleteness(filled, total, pct, empty);
    }

    public StaffSummaryDTO toSummaryDTO(Staff s,
                                        Map<Integer, List<String>> rolesMap,
                                        Map<Integer, List<String>> subjectsMap,
                                        Map<Integer, User> loginMap,
                                        Integer schoolDefaultWeeklyLoad) {
        StaffSummaryDTO dto = new StaffSummaryDTO();
        fillSummary(dto, s, rolesMap, subjectsMap, loginMap, schoolDefaultWeeklyLoad);
        return dto;
    }

    public StaffProfileDTO toProfileDTO(Staff s,
                                        Map<Integer, List<String>> rolesMap,
                                        Map<Integer, List<String>> subjectsMap,
                                        Map<Integer, User> loginMap,
                                        Integer schoolDefaultWeeklyLoad) {
        StaffProfileDTO dto = new StaffProfileDTO();
        fillSummary(dto, s, rolesMap, subjectsMap, loginMap, schoolDefaultWeeklyLoad);

        dto.setGender(s.getGender());
        dto.setDateOfBirth(s.getDateOfBirth());
        dto.setAlternatePhone(s.getAlternatePhone());
        dto.setReportingManagerStaffId(s.getReportingManagerStaffId());

        dto.setCurrentAddressLine1(s.getCurrentAddressLine1());
        dto.setCurrentAddressLine2(s.getCurrentAddressLine2());
        dto.setCity(s.getCity());
        dto.setState(s.getState());
        dto.setPincode(s.getPincode());

        dto.setEmergencyContactName(s.getEmergencyContactName());
        dto.setEmergencyContactPhone(s.getEmergencyContactPhone());
        dto.setEmergencyContactRelation(s.getEmergencyContactRelation());

        dto.setHighestQualification(s.getHighestQualification());
        dto.setProfessionalQualification(s.getProfessionalQualification());
        dto.setPreviousInstitution(s.getPreviousInstitution());

        dto.setSalaryType(s.getSalaryType());
        dto.setPayrollEnabled(s.isPayrollEnabled());
        dto.setBankAccountHolderName(s.getBankAccountHolderName());
        dto.setBankName(s.getBankName());
        dto.setBankAccountNumberMasked(StaffProfileDTO.maskBankAccount(s.getBankAccountNumber()));
        dto.setIfsc(s.getIfsc());
        dto.setPanNumberMasked(StaffProfileDTO.maskPan(s.getPanNumber()));

        dto.setProfileCompleteness(computeProfileCompleteness(s));

        return dto;
    }
}
