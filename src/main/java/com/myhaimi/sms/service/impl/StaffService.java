package com.myhaimi.sms.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.myhaimi.sms.DTO.staff.StaffProfileDTO;
import com.myhaimi.sms.DTO.staff.StaffProfileDTO.ProfileCompleteness;
import com.myhaimi.sms.DTO.staff.StaffProfileDTO.ProfileCompleteness.CategoryScore;
import com.myhaimi.sms.DTO.staff.StaffSummaryDTO;
import com.myhaimi.sms.entity.School;
import com.myhaimi.sms.entity.Staff;
import com.myhaimi.sms.entity.StaffDocument;
import com.myhaimi.sms.entity.StaffRoleMapping;
import com.myhaimi.sms.entity.enums.DocumentCollectionStatus;
import com.myhaimi.sms.entity.enums.DocumentVerificationStatus;
import com.myhaimi.sms.entity.enums.StaffStatus;
import com.myhaimi.sms.entity.enums.StaffType;
import com.myhaimi.sms.repository.SchoolRepo;
import com.myhaimi.sms.repository.StaffDocumentRepo;
import com.myhaimi.sms.repository.StaffRepo;
import com.myhaimi.sms.repository.StaffRoleMappingRepository;
import com.myhaimi.sms.repository.StaffTeachableSubjectRepository;
import com.myhaimi.sms.repository.UserRepo;
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

    private final StaffRepo                     staffRepo;
    private final SchoolRepo                    schoolRepo;
    private final UserRepo                      userRepo;
    private final StaffTeachableSubjectRepository staffTeachableSubjectRepository;
    private final StaffRoleMappingRepository    staffRoleMappingRepository;
    private final StaffDocumentRepo             staffDocumentRepo;
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

        Map<Integer, List<String>> rolesByStaff    = buildRolesMap(schoolId, page.getContent());
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

        Map<Integer, List<String>> rolesByStaff    = buildRolesMap(schoolId, List.of(staff));
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
     * Builds a staffId → List&lt;String&gt; roleName map.
     *
     * <p><strong>Authoritative source: {@link StaffRoleMapping}</strong> — staff roles
     * exist independently of a portal login account.</p>
     *
     * @param schoolId   tenant school
     * @param staffHints the staff entities already loaded by the caller (unused — kept for API compatibility)
     */
    private Map<Integer, List<String>> buildRolesMap(Integer schoolId, List<Staff> staffHints) {
        // ── Primary (sole): StaffRoleMapping ────────────────────────────────
        Map<Integer, List<String>> map = new HashMap<>();
        for (StaffRoleMapping m : staffRoleMappingRepository.findByStaff_School_Id(schoolId)) {
            if (m.getStaff() == null || m.getRole() == null) continue;
            map.computeIfAbsent(m.getStaff().getId(), k -> new ArrayList<>())
               .add(m.getRole().getName());
        }
        map.values().forEach(list -> list.sort(String::compareToIgnoreCase));
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

        // ── Roles from StaffRoleMapping (authoritative) ────────────────────────
        List<String> roles    = rolesMap.getOrDefault(s.getId(), List.of());
        List<String> subjects = subjectsMap.getOrDefault(s.getId(), List.of());
        User         user     = loginMap.get(s.getId());

        dto.setRoles(roles);
        dto.setTeachableSubjectCodes(subjects);
        dto.setHasLoginAccount(user != null);
        dto.setUserId(user != null ? user.getId() : null);
        dto.setUsername(user != null ? user.getUsername() : null);
        dto.setLastInviteSentAt(user != null ? user.getLastInviteSentAt() : null);

        // ── loginStatus: 3 honest states (NOT_CREATED / ACTIVE / DISABLED) ────
        // lastInviteSentAt is metadata only; it does not change the status.
        if (user == null) {
            dto.setLoginStatus("NOT_CREATED");
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

        List<String> missingItems = computeMissingItems(s, roles, subjects, schoolDefaultWeeklyLoad);
        dto.setMissingRequiredItems(missingItems);
        dto.setActivationInconsistent(isActivationInconsistent(s, roles));
        dto.setCreatedAt(s.getCreatedAt());
        dto.setUpdatedAt(s.getUpdatedAt());
    }

    // ── Computed helpers ───────────────────────────────────────────────────────

    /**
     * Returns true when the staff record is ACTIVE but is missing one or more
     * fields that are required for activation: fullName, phone, staffType,
     * designation, joiningDate, or at least one role.
     * This is an inconsistent state the UI must surface prominently.
     */
    private static boolean isActivationInconsistent(Staff s, List<String> roles) {
        if (s.getStatus() != StaffStatus.ACTIVE) return false;
        return (s.getFullName()    == null || s.getFullName().isBlank())
            || (s.getPhone()       == null || s.getPhone().isBlank())
            ||  s.getStaffType()   == null
            || (s.getDesignation() == null || s.getDesignation().isBlank())
            ||  s.getJoiningDate() == null
            ||  roles.isEmpty();
    }

    /**
     * Returns human-readable reasons why a staff member is not timetable eligible.
     * An empty list means the staff IS eligible.
     */
    public static List<String> computeIneligibilityReasons(
            boolean isActive, boolean isTeaching, boolean hasTeacherRole,
            boolean hasSubjects, boolean hasLoadCapacity) {
        List<String> r = new ArrayList<>();
        if (!isActive)        r.add("Staff not ACTIVE");
        if (!isTeaching)      r.add("Not TEACHING staff type");
        if (!hasTeacherRole)  r.add("No TEACHER role");
        if (!hasSubjects)     r.add("No teachable subjects");
        if (!hasLoadCapacity) r.add("Missing max weekly lecture load (set on staff or configure school default)");
        return r;
    }

    /**
     * Backward-compatible 4-arg overload (assumes load capacity is satisfied).
     * @deprecated Use the 5-arg version.
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
        // Joining date: tailor the message to current status
        if (s.getJoiningDate() == null) {
            if (s.getStatus() == StaffStatus.ACTIVE)
                missing.add("Joining date is missing — status should not be ACTIVE without it.");
            else
                missing.add("Joining date is required to activate this staff member.");
        }
        if (s.getStaffType() == StaffType.TEACHING) {
            boolean hasTeacherRole = roles.stream().anyMatch(r -> RoleNames.TEACHER.equalsIgnoreCase(r));
            if (!hasTeacherRole) {
                missing.add("TEACHER role is recommended for TEACHING staff to enable timetable assignment.");
            } else {
                if (subjects.isEmpty())
                    missing.add("At least one teachable subject is required for timetable eligibility.");
                if (s.getMaxWeeklyLectureLoad() == null && schoolDefaultWeeklyLoad == null)
                    missing.add("Max weekly lecture load is required (set here or configure a school default).");
            }
        }
        if (s.getEmail() == null || s.getEmail().isBlank())
            missing.add("Email is required to enable login account.");
        return missing;
    }

    private StaffProfileDTO.ProfileCompleteness computeProfileCompleteness(
            Staff s, List<String> roles, List<String> subjects, User user, Integer schoolDefaultWeeklyLoad) {

        List<CategoryScore> cats = new ArrayList<>();

        // ── 1. Identity (20%) ─────────────────────────────────────────────────
        {
            List<String> miss = new ArrayList<>();
            int score = 0;
            if (s.getFullName() != null && !s.getFullName().isBlank())       score += 35; else miss.add("Full name is required");
            if (s.getPhone()    != null && !s.getPhone().isBlank())           score += 35; else miss.add("Phone number is required");
            if (s.getEmail()    != null && !s.getEmail().isBlank())           score += 20; else miss.add("Email not provided (needed for login)");
            if (s.getEmployeeNo() != null && !s.getEmployeeNo().isBlank())    score += 10; else miss.add("Employee number not set");
            cats.add(new CategoryScore("identity", "Identity", "👤", 20, Math.min(score, 100), miss));
        }

        // ── 2. Employment (25%) ───────────────────────────────────────────────
        {
            List<String> miss = new ArrayList<>();
            int score = 0;
            if (s.getStaffType()      != null)                                           score += 15; else miss.add("Staff type not set");
            if (s.getDesignation()    != null && !s.getDesignation().isBlank())          score += 15; else miss.add("Designation not set");
            if (s.getJoiningDate()    != null)                                           score += 25; else miss.add("Joining date not set");
            if (s.getStatus()         != null && s.getStatus() != StaffStatus.DRAFT)     score += 20; else miss.add("Status still DRAFT — activate when ready");
            if (s.getEmploymentType() != null)                                           score += 15; else miss.add("Employment type not set");
            if (s.getDepartment()     != null && !s.getDepartment().isBlank())           score += 10; else miss.add("Department not set");
            cats.add(new CategoryScore("employment", "Employment", "💼", 25, Math.min(score, 100), miss));
        }

        // ── 3. Academics (20%) ────────────────────────────────────────────────
        {
            List<String> miss = new ArrayList<>();
            int score;
            if (s.getStaffType() == StaffType.TEACHING) {
                score = 0;
                boolean hasTeacherRole = roles.stream().anyMatch(r -> RoleNames.TEACHER.equalsIgnoreCase(r));
                boolean hasLoad        = s.getMaxWeeklyLectureLoad() != null || schoolDefaultWeeklyLoad != null;
                if (hasTeacherRole)        score += 40; else miss.add("TEACHER role not assigned");
                if (!subjects.isEmpty())   score += 35; else miss.add("No teachable subjects assigned");
                if (hasLoad)               score += 25; else miss.add("Max weekly lecture load not set");
            } else {
                // Non-teaching staff: academic section not applicable — full marks
                score = 100;
                miss.add("Not applicable for non-teaching staff");
                // Clear "not applicable" info message so the UI doesn't show it as a blocker
                miss.clear();
            }
            cats.add(new CategoryScore("academics", "Academics", "📚", 20, Math.min(score, 100), miss));
        }

        // ── 4. Documents (15%) ────────────────────────────────────────────────
        {
            List<String> miss = new ArrayList<>();
            int score;
            List<StaffDocument> docs = staffDocumentRepo.findByStaff_IdOrderByCreatedAtAsc(s.getId());
            // Exclude NOT_REQUIRED rows from denominator — they are not real work items
            List<StaffDocument> required = docs.stream()
                    .filter(d -> d.getCollectionStatus() != DocumentCollectionStatus.NOT_REQUIRED)
                    .toList();
            if (required.isEmpty()) {
                score = 100; // no documents configured yet — not penalised
            } else {
                long done = required.stream().filter(d ->
                        d.getCollectionStatus() == DocumentCollectionStatus.COLLECTED_PHYSICAL
                        || d.getVerificationStatus() == DocumentVerificationStatus.VERIFIED
                        || (d.getUploadStatus() != null && "UPLOADED".equals(d.getUploadStatus().name()))
                ).count();
                score = (int) (done * 100L / required.size());
                if (score < 100) miss.add(String.format("%d of %d required documents collected or verified", done, required.size()));
            }
            cats.add(new CategoryScore("documents", "Documents", "📄", 15, score, miss));
        }

        // ── 5. Access (10%) ───────────────────────────────────────────────────
        {
            List<String> miss = new ArrayList<>();
            int score = 0;
            if (user != null) {
                score += 60;
                if (user.isEnabled()) score += 40; else miss.add("Login account is disabled");
            } else {
                miss.add("No login account created");
            }
            cats.add(new CategoryScore("access", "Access", "🔐", 10, score, miss));
        }

        // ── 6. Payroll Prep (10%) ─────────────────────────────────────────────
        {
            List<String> miss = new ArrayList<>();
            int score = 0;
            boolean hasAnyBankData = (s.getBankAccountNumber() != null && !s.getBankAccountNumber().isBlank())
                    || (s.getBankName() != null && !s.getBankName().isBlank());
            if (!s.isPayrollEnabled() && !hasAnyBankData) {
                // Payroll deliberately not set up — treat as "not applicable", give neutral partial score
                score = 30;
                miss.add("Payroll not enabled (optional — enable if school uses payroll)");
            } else {
                if (s.isPayrollEnabled())                                         score += 20; else miss.add("Payroll not enabled");
                if (s.getSalaryType() != null)                                    score += 20; else miss.add("Salary type not set");
                if (s.getBankName()    != null && !s.getBankName().isBlank())     score += 20; else miss.add("Bank name missing");
                String acct = s.getBankAccountNumber();
                if (acct != null && !acct.isBlank())                              score += 25; else miss.add("Bank account number missing");
                if (s.getIfsc()        != null && !s.getIfsc().isBlank())         score += 15; else miss.add("IFSC code missing");
            }
            cats.add(new CategoryScore("payroll", "Payroll Prep", "💰", 10, Math.min(score, 100), miss));
        }

        // ── Overall weighted score ─────────────────────────────────────────────
        int overall = cats.stream()
                .mapToInt(c -> c.score() * c.weight() / 100)
                .sum();

        // Legacy backward-compat fields
        int filledSections = (int) cats.stream().filter(c -> c.score() >= 50).count();
        int totalSections  = cats.size();
        List<String> emptySections = cats.stream()
                .filter(c -> c.score() < 50)
                .map(ProfileCompleteness.CategoryScore::name)
                .toList();

        return new ProfileCompleteness(overall, cats, filledSections, totalSections, emptySections);
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

        List<String> roles    = rolesMap.getOrDefault(s.getId(), List.of());
        List<String> subjects = subjectsMap.getOrDefault(s.getId(), List.of());
        User         user     = loginMap.get(s.getId());
        dto.setProfileCompleteness(computeProfileCompleteness(s, roles, subjects, user, schoolDefaultWeeklyLoad));

        return dto;
    }
}
