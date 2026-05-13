package com.myhaimi.sms.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.myhaimi.sms.DTO.OnboardingBasicInfoDTO;
import com.myhaimi.sms.DTO.OnboardingBasicInfoTimeWindowDTO;
import com.myhaimi.sms.DTO.OnboardingClassesSetupDTO;
import com.myhaimi.sms.DTO.OnboardingClassesSetupResultDTO;
import com.myhaimi.sms.DTO.OnboardingProgressDTO;
import com.myhaimi.sms.DTO.OnboardingSubjectClassMappingDTO;
import com.myhaimi.sms.DTO.OnboardingSubjectClassMappingsResultDTO;
import com.myhaimi.sms.DTO.OnboardingSubjectGradeMappingDTO;
import com.myhaimi.sms.DTO.OnboardingSubjectCreateDTO;
import com.myhaimi.sms.DTO.OnboardingSubjectsSetupResultDTO;
import com.myhaimi.sms.DTO.OnboardingRoomCreateDTO;
import com.myhaimi.sms.DTO.OnboardingRoomsSetupResultDTO;
import com.myhaimi.sms.DTO.OnboardingClassDefaultRoomItemDTO;
import com.myhaimi.sms.DTO.OnboardingClassDefaultRoomViewDTO;
import com.myhaimi.sms.DTO.OnboardingStaffCreateDTO;
import com.myhaimi.sms.DTO.OnboardingStaffSetupResultDTO;
import com.myhaimi.sms.DTO.OnboardingStaffUserCredentialDTO;
import com.myhaimi.sms.DTO.OnboardingStaffViewDTO;
import com.myhaimi.sms.DTO.OnboardingStaffUpdateDTO;
import com.myhaimi.sms.DTO.StaffDeleteInfoDTO;
import com.myhaimi.sms.DTO.OnboardingFeesSetupDTO;
import com.myhaimi.sms.DTO.OnboardingAcademicAllocationInputDTO;
import com.myhaimi.sms.DTO.OnboardingClassTeacherItemDTO;
import com.myhaimi.sms.DTO.OnboardingAcademicStructureSaveDTO;
import com.myhaimi.sms.DTO.OnboardingAcademicStructureViewDTO;
import com.myhaimi.sms.DTO.OnboardingAcademicSubjectItemDTO;
import com.myhaimi.sms.DTO.OnboardingAcademicStaffItemDTO;
import com.myhaimi.sms.DTO.OnboardingAcademicClassGroupItemDTO;
import com.myhaimi.sms.DTO.OnboardingAcademicAllocationItemDTO;
import com.myhaimi.sms.DTO.OnboardingClassSubjectConfigDTO;
import com.myhaimi.sms.DTO.OnboardingSectionSubjectOverrideDTO;
import com.myhaimi.sms.DTO.OnboardingAcademicSlotMetaDTO;
import com.myhaimi.sms.DTO.TeacherDemandSubjectRowDTO;
import com.myhaimi.sms.DTO.TeacherDemandSummaryDTO;
import com.myhaimi.sms.DTO.OnboardingTimetableAutoGenerateViewDTO;
import com.myhaimi.sms.DTO.OnboardingTimetableClassAutoFillItemDTO;
import com.myhaimi.sms.DTO.timetable.v2.AutoFillRequestDTO;
import com.myhaimi.sms.DTO.timetable.v2.AutoFillResultDTO;
import com.myhaimi.sms.DTO.timetable.v2.TimetableVersionViewDTO;
import com.myhaimi.sms.DTO.OnboardingStudentCreateDTO;
import com.myhaimi.sms.DTO.OnboardingStudentsSetupResultDTO;
import com.myhaimi.sms.DTO.staff.StaffProfileDTO;
import com.myhaimi.sms.DTO.staff.onboarding.StaffOnboardingRequest;
import com.myhaimi.sms.DTO.staff.onboarding.StaffOnboardingResult;
import com.myhaimi.sms.academic.SubjectAllocationVenueParsing;
import com.myhaimi.sms.academic.RoomTypeParsing;
import com.myhaimi.sms.entity.ClassGroup;
import com.myhaimi.sms.entity.Building;
import com.myhaimi.sms.entity.Floor;
import com.myhaimi.sms.entity.LabType;
import com.myhaimi.sms.entity.OnboardingStatus;
import com.myhaimi.sms.entity.School;
import com.myhaimi.sms.entity.AttendanceMode;
import com.myhaimi.sms.entity.Subject;
import com.myhaimi.sms.entity.SubjectAllocationVenueRequirement;
import com.myhaimi.sms.entity.SubjectClassMapping;
import com.myhaimi.sms.entity.SubjectClassGroup;
import com.myhaimi.sms.entity.SubjectSectionOverride;
import com.myhaimi.sms.entity.SubjectType;
import com.myhaimi.sms.entity.Room;
import com.myhaimi.sms.entity.RoomType;
import com.myhaimi.sms.entity.SubjectAllocation;
import com.myhaimi.sms.entity.ClassSubjectConfig;
import com.myhaimi.sms.entity.StaffTeachableSubject;
import com.myhaimi.sms.entity.AcademicYear;
import com.myhaimi.sms.entity.Student;
import com.myhaimi.sms.entity.Guardian;
import com.myhaimi.sms.entity.StudentAcademicEnrollment;
import com.myhaimi.sms.entity.StudentGuardian;
import com.myhaimi.sms.entity.enums.StudentAcademicEnrollmentStatus;
import com.myhaimi.sms.entity.enums.StaffStatus;
import com.myhaimi.sms.entity.enums.StaffType;
import com.myhaimi.sms.repository.AcademicYearRepo;
import com.myhaimi.sms.repository.ClassGroupRepo;
import com.myhaimi.sms.repository.BuildingRepo;
import com.myhaimi.sms.repository.FloorRepo;
import com.myhaimi.sms.repository.SchoolRepo;
import com.myhaimi.sms.repository.SubjectClassMappingRepo;
import com.myhaimi.sms.repository.SubjectClassGroupRepo;
import com.myhaimi.sms.repository.SubjectRepo;
import com.myhaimi.sms.repository.SubjectSectionOverrideRepo;
import com.myhaimi.sms.repository.ClassSubjectConfigRepo;
import com.myhaimi.sms.repository.RoomRepo;
import com.myhaimi.sms.repository.RoleRepo;
import com.myhaimi.sms.repository.StaffRepo;
import com.myhaimi.sms.repository.StudentRepo;
import com.myhaimi.sms.repository.StudentGuardianRepo;
import com.myhaimi.sms.repository.StudentAcademicEnrollmentRepo;
import com.myhaimi.sms.repository.GuardianRepo;
import com.myhaimi.sms.repository.StaffRoleMappingRepository;
import com.myhaimi.sms.repository.StaffTeachableSubjectRepository;
import com.myhaimi.sms.repository.SubjectAllocationRepo;
import com.myhaimi.sms.repository.TimetableEntryRepo;
import com.myhaimi.sms.repository.UserRepo;
import com.myhaimi.sms.entity.Role;
import com.myhaimi.sms.entity.Staff;
import com.myhaimi.sms.entity.StaffRoleMapping;
import com.myhaimi.sms.entity.User;
import com.myhaimi.sms.security.RoleNames;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.Authentication;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.HashMap;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class SchoolOnboardingService {

    private static final TypeReference<List<String>> STR_LIST = new TypeReference<>() {};
    private static final TypeReference<List<Integer>> INT_LIST = new TypeReference<>() {};
    private static final TypeReference<List<OnboardingAcademicSlotMetaDTO>> SLOT_META_LIST = new TypeReference<>() {};

    private final SchoolRepo schoolRepo;
    private final ClassGroupRepo classGroupRepo;
    private final SubjectRepo subjectRepo;
    private final SubjectClassGroupRepo subjectClassGroupRepo;
    private final SubjectClassMappingRepo subjectClassMappingRepo;
    private final SubjectSectionOverrideRepo subjectSectionOverrideRepo;
    private final RoomRepo roomRepo;
    private final BuildingRepo buildingRepo;
    private final FloorRepo floorRepo;
    private final StaffRepo staffRepo;
    private final UserRepo userRepo;
    private final RoleRepo roleRepo;
    private final PasswordEncoder passwordEncoder;
    private final ObjectMapper objectMapper;
    private final StudentRepo studentRepo;
    private final GuardianRepo guardianRepo;
    private final AcademicYearRepo academicYearRepo;
    private final StudentAcademicEnrollmentRepo studentAcademicEnrollmentRepo;
    private final StudentGuardianRepo studentGuardianRepo;
    private final SubjectAllocationRepo subjectAllocationRepo;
    private final ClassSubjectConfigRepo classSubjectConfigRepo;
    private final StaffTeachableSubjectRepository staffTeachableSubjectRepository;
    private final StaffRoleMappingRepository staffRoleMappingRepository;
    private final TimetableEntryRepo timetableEntryRepo;
    private final TimetableGridV2Service timetableGridV2Service;
    private final TeacherDemandAnalysisService teacherDemandAnalysisService;
    private final StaffService staffService;
    private final StaffDocumentService staffDocumentService;

    private List<Integer> parseIntListJson(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json, INT_LIST);
        } catch (Exception e) {
            return List.of();
        }
    }

    private void applyStaffLoadAndPrefs(Staff st, Integer maxLoad, List<Integer> preferredIds) {
        st.setMaxWeeklyLectureLoad(maxLoad);
        try {
            if (preferredIds != null && !preferredIds.isEmpty()) {
                st.setPreferredClassGroupIdsJson(objectMapper.writeValueAsString(preferredIds));
            } else {
                st.setPreferredClassGroupIdsJson(null);
            }
        } catch (Exception e) {
            throw new IllegalArgumentException("Could not store preferred class groups", e);
        }
    }

    private Integer requireSchoolId() {
        Integer id = TenantContext.getSchoolId();
        if (id == null) throw new IllegalStateException("Missing school context");
        return id;
    }

    private String actorEmailOrSystem() {
        try {
            Authentication a = SecurityContextHolder.getContext().getAuthentication();
            String name = a == null ? null : a.getName();
            if (name == null || name.isBlank()) return "system";
            return name.trim();
        } catch (Exception ignored) {
            return "system";
        }
    }

    @Transactional(readOnly = true)
    public OnboardingProgressDTO progress() {
        School s = schoolRepo.findById(requireSchoolId()).orElseThrow();
        List<String> completed = parseCompleted(s.getOnboardingCompletedJson());
        return new OnboardingProgressDTO(s.getOnboardingStatus().name(), completed);
    }

    @Transactional
    public void saveBasicInfo(OnboardingBasicInfoDTO dto) {
        School s = schoolRepo.findById(requireSchoolId()).orElseThrow();
        // Back-compat: if openWindows provided, derive schoolStartTime/endTime for older consumers.
        // We store the full DTO JSON as-is.
        if (dto.openWindows() != null && !dto.openWindows().isEmpty()) {
            java.util.List<OnboardingBasicInfoTimeWindowDTO> wins = dto.openWindows().stream()
                    .filter(w -> w != null && w.startTime() != null && w.endTime() != null)
                    .toList();
            if (!wins.isEmpty()) {
                String minStart = wins.stream().map(OnboardingBasicInfoTimeWindowDTO::startTime).min(String::compareTo).orElse(dto.schoolStartTime());
                String maxEnd = wins.stream().map(OnboardingBasicInfoTimeWindowDTO::endTime).max(String::compareTo).orElse(dto.schoolEndTime());
                dto = new OnboardingBasicInfoDTO(
                        dto.academicYear(),
                        dto.startMonth(),
                        dto.workingDays(),
                        dto.attendanceMode(),
                        dto.openWindows(),
                        minStart,
                        maxEnd,
                        dto.lectureDurationMinutes()
                );
            }
        }
        try {
            s.setOnboardingBasicInfoJson(objectMapper.writeValueAsString(dto));
        } catch (Exception e) {
            throw new IllegalArgumentException("Could not serialize onboarding basic info");
        }
        // Persist core setting to the school row (used across the product).
        s.setAttendanceMode(dto.attendanceMode() == null ? AttendanceMode.LECTURE_WISE : dto.attendanceMode());
        markCompleted(s, OnboardingStatus.BASIC_INFO);
        // Move to next step (classes) as default flow
        s.setOnboardingStatus(OnboardingStatus.CLASSES);
        schoolRepo.save(s);
    }

    @Transactional
    public OnboardingClassesSetupResultDTO generateClasses(OnboardingClassesSetupDTO dto) {
        if (dto.fromGrade() < 1 || dto.toGrade() > 12 || dto.fromGrade() > dto.toGrade()) {
            throw new IllegalArgumentException("Grade range must be between 1 and 12 (from <= to).");
        }
        Integer schoolId = requireSchoolId();
        School school = schoolRepo.findById(schoolId).orElseThrow();
        String actor = actorEmailOrSystem();

        // Determine sections per grade (either global sections or grade-specific overrides)
        List<OnboardingClassesSetupDTO.GradeSectionsDTO> gradeSections = dto.gradeSections();
        final java.util.Map<Integer, List<String>> sectionsByGrade = new java.util.LinkedHashMap<>();

        if (gradeSections != null && !gradeSections.isEmpty()) {
            for (OnboardingClassesSetupDTO.GradeSectionsDTO gs : gradeSections) {
                if (gs == null || gs.gradeLevel() == null) continue;
                if (gs.gradeLevel() < dto.fromGrade() || gs.gradeLevel() > dto.toGrade()) continue;
                List<String> secs = gs.sections() == null ? List.of() : gs.sections().stream()
                        .map(s -> s == null ? "" : s.trim().toUpperCase())
                        .filter(s -> !s.isBlank())
                        .distinct()
                        .toList();
                if (!secs.isEmpty()) {
                    sectionsByGrade.put(gs.gradeLevel(), secs);
                }
            }
        }

        if (sectionsByGrade.isEmpty()) {
            List<String> globalSections = dto.sections() == null ? List.of() : dto.sections().stream()
                    .map(s -> s == null ? "" : s.trim().toUpperCase())
                    .filter(s -> !s.isBlank())
                    .distinct()
                    .toList();
            if (globalSections.isEmpty()) {
                throw new IllegalArgumentException("At least one section is required.");
            }
            for (int g = dto.fromGrade(); g <= dto.toGrade(); g++) {
                sectionsByGrade.put(g, globalSections);
            }
        }

        List<String> createdCodes = new ArrayList<>();
        int skipped = 0;

        for (int g = dto.fromGrade(); g <= dto.toGrade(); g++) {
            List<String> secs = sectionsByGrade.get(g);
            if (secs == null || secs.isEmpty()) continue; // allow "skip" grades in per-grade mode
            for (String sec : secs) {
                String code = g + "-" + sec;
                java.util.Optional<ClassGroup> existingOpt = classGroupRepo.findByCodeAndSchool_Id(code, schoolId);
                if (existingOpt.isPresent()) {
                    ClassGroup existing = existingOpt.get();
                    // If class was soft-deleted earlier (e.g. via "Delete all classes"), revive it so onboarding can re-generate safely.
                    if (existing.isDeleted()) {
                        existing.setDeleted(false);
                        existing.setGradeLevel(g);
                        existing.setSection(sec);
                        existing.setDisplayName("Grade " + g + " — Section " + sec);
                        if (dto.defaultCapacity() != null && dto.defaultCapacity() > 0) {
                            existing.setCapacity(dto.defaultCapacity());
                        }
                        existing.setUpdatedBy(actor);
                        classGroupRepo.save(existing);
                        createdCodes.add(code);
                        continue;
                    }
                    skipped += 1;
                    continue;
                }
                ClassGroup cg = new ClassGroup();
                cg.setSchool(school);
                cg.setGradeLevel(g);
                cg.setSection(sec);
                cg.setCode(code);
                cg.setDisplayName("Grade " + g + " — Section " + sec);
                if (dto.defaultCapacity() != null && dto.defaultCapacity() > 0) {
                    cg.setCapacity(dto.defaultCapacity());
                }
                cg.setCreatedBy(actor);
                cg.setUpdatedBy(actor);
                classGroupRepo.save(cg);
                createdCodes.add(code);
            }
        }

        // mark onboarding step complete and advance
        markCompleted(school, OnboardingStatus.CLASSES);
        school.setOnboardingStatus(OnboardingStatus.SUBJECTS);
        schoolRepo.save(school);

        return new OnboardingClassesSetupResultDTO(createdCodes.size(), createdCodes, skipped);
    }

    private static void applyOnboardingSubjectVenue(Subject s, OnboardingSubjectCreateDTO dto) {
        var req = SubjectAllocationVenueParsing.parseRequirement(dto.allocationVenueRequirement());
        s.setAllocationVenueRequirement(req);
        if (req != SubjectAllocationVenueRequirement.SPECIALIZED_ROOM) {
            s.setSpecializedVenueType(null);
            return;
        }
        String sv = dto.specializedVenueType() == null ? "" : dto.specializedVenueType().trim();
        if (sv.isEmpty()) {
            s.setSpecializedVenueType(null);
            return;
        }
        try {
            s.setSpecializedVenueType(RoomType.valueOf(sv.toUpperCase()));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid specializedVenueType for subject " + s.getCode() + ": " + sv);
        }
    }

    @Transactional
    public OnboardingSubjectsSetupResultDTO createSubjects(List<OnboardingSubjectCreateDTO> dtos) {
        Integer schoolId = requireSchoolId();
        School school = schoolRepo.findById(schoolId).orElseThrow();
        String actor = actorEmailOrSystem();
        if (dtos == null || dtos.isEmpty()) {
            throw new IllegalArgumentException("At least one subject is required.");
        }

        int created = 0;
        int skipped = 0;
        List<String> createdCodes = new ArrayList<>();
        java.util.Set<String> seenCodes = new java.util.HashSet<>();

        for (OnboardingSubjectCreateDTO dto : dtos) {
            String code = dto.code() == null ? "" : dto.code().trim().toUpperCase();
            String name = dto.name() == null ? "" : dto.name().trim();
            if (code.isBlank() || name.isBlank()) {
                throw new IllegalArgumentException("Subject name and code are required.");
            }
            if (!code.matches("^[A-Z0-9]{3,32}$")) {
                throw new IllegalArgumentException("Subject code must be 3–32 chars, uppercase A–Z/0–9 only (no spaces).");
            }
            if (seenCodes.contains(code)) {
                throw new IllegalArgumentException("Duplicate subject code in request: " + code);
            }
            seenCodes.add(code);
            var existingOpt = subjectRepo.findBySchool_IdAndCode(schoolId, code);
            if (existingOpt.isPresent()) {
                Subject existing = existingOpt.get();
                if (!existing.isDeleted()) {
                    skipped += 1;
                    continue;
                }
                // Revive soft-deleted subject (idempotent onboarding re-run).
                Integer weekly = dto.weeklyFrequency();
                if (weekly == null || weekly <= 0) {
                    throw new IllegalArgumentException("weeklyFrequency is required and must be positive for subject " + code);
                }
                SubjectType type;
                try {
                    type = SubjectType.valueOf((dto.type() == null ? "CORE" : dto.type().trim().toUpperCase()));
                } catch (Exception e) {
                    type = SubjectType.CORE;
                }
                existing.setDeleted(false);
                existing.setName(name);
                existing.setType(type);
                existing.setWeeklyFrequency(weekly);
                applyOnboardingSubjectVenue(existing, dto);
                existing.setUpdatedBy(actor);
                subjectRepo.save(existing);
                created += 1;
                createdCodes.add(code);
                continue;
            }
            Subject s = new Subject();
            s.setSchool(school);
            s.setCode(code);
            s.setName(name);
            SubjectType type;
            try {
                type = SubjectType.valueOf((dto.type() == null ? "CORE" : dto.type().trim().toUpperCase()));
            } catch (Exception e) {
                type = SubjectType.CORE;
            }
            s.setType(type);
            Integer weekly = dto.weeklyFrequency();
            if (weekly == null || weekly <= 0) {
                throw new IllegalArgumentException("weeklyFrequency is required and must be positive for subject " + code);
            }
            s.setWeeklyFrequency(weekly);
            applyOnboardingSubjectVenue(s, dto);
            s.setCreatedBy(actor);
            s.setUpdatedBy(actor);
            subjectRepo.save(s);
            created += 1;
            createdCodes.add(code);
        }

        markCompleted(school, OnboardingStatus.SUBJECTS);
        school.setOnboardingStatus(OnboardingStatus.ROOMS);
        schoolRepo.save(school);

        return new OnboardingSubjectsSetupResultDTO(created, skipped, 0, createdCodes);
    }

    @Transactional(readOnly = true)
    public List<OnboardingSubjectClassMappingDTO> listSubjectClassMappings() {
        Integer schoolId = requireSchoolId();
        List<Subject> subjects = subjectRepo.findBySchool_IdAndIsDeletedFalseOrderByCodeAsc(schoolId);
        List<SubjectClassMapping> gradeMappings = subjectClassMappingRepo.findBySubject_School_Id(schoolId);
        List<SubjectSectionOverride> overrides = subjectSectionOverrideRepo.findBySubject_School_Id(schoolId);

        Map<Integer, Map<Integer, Boolean>> appliesAllBySubjectId = new LinkedHashMap<>();
        for (SubjectClassMapping m : gradeMappings) {
            appliesAllBySubjectId
                    .computeIfAbsent(m.getSubject().getId(), k -> new LinkedHashMap<>())
                    .put(m.getGradeLevel(), Boolean.TRUE.equals(m.getAppliesToAllSections()));
        }

        Map<Integer, Map<Integer, Set<Integer>>> overridesBySubjectId = new LinkedHashMap<>();
        for (SubjectSectionOverride o : overrides) {
            Integer subjectId = o.getSubject().getId();
            Integer grade = o.getClassGroup().getGradeLevel();
            if (grade == null) continue;
            overridesBySubjectId
                    .computeIfAbsent(subjectId, k -> new LinkedHashMap<>())
                    .computeIfAbsent(grade, k -> new LinkedHashSet<>())
                    .add(o.getClassGroup().getId());
        }

        List<OnboardingSubjectClassMappingDTO> out = new ArrayList<>();
        for (Subject s : subjects) {
            Map<Integer, Boolean> appliesByGrade = appliesAllBySubjectId.getOrDefault(s.getId(), Map.of());
            Map<Integer, Set<Integer>> overridesByGrade = overridesBySubjectId.getOrDefault(s.getId(), Map.of());

            Set<Integer> allGrades = new LinkedHashSet<>();
            allGrades.addAll(appliesByGrade.keySet());
            allGrades.addAll(overridesByGrade.keySet());

            List<OnboardingSubjectGradeMappingDTO> rows = new ArrayList<>();
            for (Integer grade : allGrades) {
                Boolean appliesAll = appliesByGrade.getOrDefault(grade, true);
                List<Integer> classGroupIds = new ArrayList<>(overridesByGrade.getOrDefault(grade, Set.of()));
                rows.add(new OnboardingSubjectGradeMappingDTO(grade, appliesAll, classGroupIds));
            }

            out.add(new OnboardingSubjectClassMappingDTO(s.getCode(), rows));
        }
        return out;
    }

    @Transactional
    public OnboardingSubjectClassMappingsResultDTO saveSubjectClassMappings(List<OnboardingSubjectClassMappingDTO> body) {
        Integer schoolId = requireSchoolId();
        School school = schoolRepo.findById(schoolId).orElseThrow();
        List<Subject> allSubjects = subjectRepo.findBySchool_IdAndIsDeletedFalseOrderByCodeAsc(schoolId);
        if (allSubjects.isEmpty()) {
            throw new IllegalArgumentException("Create subjects before mapping classes.");
        }

        // Build desired grade mappings + overrides per subject code.
        Map<String, Map<Integer, OnboardingSubjectGradeMappingDTO>> desired = new LinkedHashMap<>();
        if (body != null) {
            for (OnboardingSubjectClassMappingDTO row : body) {
                if (row == null) continue;
                String code = row.subjectCode() == null ? "" : row.subjectCode().trim().toUpperCase();
                if (code.isBlank()) continue;
                Map<Integer, OnboardingSubjectGradeMappingDTO> byGrade = desired.computeIfAbsent(code, k -> new LinkedHashMap<>());
                if (row.classMappings() == null) continue;
                for (OnboardingSubjectGradeMappingDTO gm : row.classMappings()) {
                    if (gm == null || gm.gradeLevel() == null) continue;
                    byGrade.put(gm.gradeLevel(), gm);
                }
            }
        }

        // Validate + materialize to subject_class_groups.
        Map<Integer, List<ClassGroup>> classGroupsByGrade = new LinkedHashMap<>();
        for (ClassGroup cg : classGroupRepo.findBySchool_IdAndIsDeletedFalse(Integer.valueOf(schoolId), org.springframework.data.domain.Pageable.unpaged()).getContent()) {
            if (cg.getGradeLevel() == null) continue;
            classGroupsByGrade.computeIfAbsent(cg.getGradeLevel(), k -> new ArrayList<>()).add(cg);
        }

        for (Subject s : allSubjects) {
            Map<Integer, OnboardingSubjectGradeMappingDTO> byGrade = desired.get(s.getCode());
            if (byGrade == null || byGrade.isEmpty()) {
                throw new IllegalArgumentException("Each subject must map to at least one class. Missing: " + s.getCode());
            }
            for (OnboardingSubjectGradeMappingDTO gm : byGrade.values()) {
                Integer grade = gm.gradeLevel();
                if (grade == null) continue;
                if (!classGroupsByGrade.containsKey(grade)) {
                    throw new IllegalArgumentException("Grade " + grade + " has no sections configured (classes).");
                }
                boolean appliesAll = gm.appliesToAllSections() != null && gm.appliesToAllSections();
                if (!appliesAll) {
                    List<Integer> ids = gm.classGroupIds() == null ? List.of() : gm.classGroupIds();
                    if (ids.isEmpty()) {
                        throw new IllegalArgumentException("Select at least one section for Grade " + grade + " (" + s.getCode() + ").");
                    }
                    for (Integer id : ids) {
                        ClassGroup cg = classGroupRepo.findByIdAndSchool_Id(id, schoolId)
                                .orElseThrow(() -> new IllegalArgumentException("Invalid class id " + id + " for this school."));
                        if (cg.getGradeLevel() == null || !cg.getGradeLevel().equals(grade)) {
                            throw new IllegalArgumentException("Class id " + id + " is not in Grade " + grade + ".");
                        }
                    }
                }
            }
        }

        // Clear previous mapping state (v2 tables + materialized mapping)
        subjectSectionOverrideRepo.deleteBySubjectSchool_Id(schoolId);
        subjectClassMappingRepo.deleteBySubjectSchool_Id(schoolId);
        subjectClassGroupRepo.deleteBySubjectSchool_Id(schoolId);

        int created = 0;
        for (Subject s : allSubjects) {
            Map<Integer, OnboardingSubjectGradeMappingDTO> byGrade = desired.get(s.getCode());
            for (OnboardingSubjectGradeMappingDTO gm : byGrade.values()) {
                Integer grade = gm.gradeLevel();
                boolean appliesAll = gm.appliesToAllSections() != null && gm.appliesToAllSections();

                SubjectClassMapping scm = new SubjectClassMapping();
                scm.setSubject(s);
                scm.setGradeLevel(grade);
                scm.setAppliesToAllSections(appliesAll);
                subjectClassMappingRepo.save(scm);

                if (appliesAll) {
                    for (ClassGroup cg : classGroupsByGrade.getOrDefault(grade, List.of())) {
                        SubjectClassGroup scg = new SubjectClassGroup();
                        scg.setSubject(s);
                        scg.setClassGroup(cg);
                        subjectClassGroupRepo.save(scg);
                        created += 1;
                    }
                } else {
                    List<Integer> ids = gm.classGroupIds() == null ? List.of() : gm.classGroupIds();
                    for (Integer id : new LinkedHashSet<>(ids)) {
                        ClassGroup cg = classGroupRepo.findByIdAndSchool_Id(id, schoolId).orElseThrow();
                        SubjectSectionOverride sso = new SubjectSectionOverride();
                        sso.setSubject(s);
                        sso.setClassGroup(cg);
                        subjectSectionOverrideRepo.save(sso);

                        SubjectClassGroup scg = new SubjectClassGroup();
                        scg.setSubject(s);
                        scg.setClassGroup(cg);
                        subjectClassGroupRepo.save(scg);
                        created += 1;
                    }
                }
            }
        }

        markCompleted(school, OnboardingStatus.SUBJECT_CLASS_MAPPING);
        school.setOnboardingStatus(OnboardingStatus.ROOMS);
        schoolRepo.save(school);

        return new OnboardingSubjectClassMappingsResultDTO(created);
    }

    @Transactional
    public OnboardingRoomsSetupResultDTO createRooms(List<OnboardingRoomCreateDTO> dtos) {
        Integer schoolId = requireSchoolId();
        School school = schoolRepo.findById(schoolId).orElseThrow();
        String actor = actorEmailOrSystem();
        if (dtos == null || dtos.isEmpty()) {
            throw new IllegalArgumentException("At least one room is required.");
        }
        int created = 0;
        int skipped = 0;
        List<String> keys = new ArrayList<>();

        for (OnboardingRoomCreateDTO dto : dtos) {
            String building = dto.building() == null ? "" : dto.building().trim();
            String floor = dto.floor() == null ? "" : dto.floor().trim();
            String roomNumber = dto.roomNumber() == null ? "" : dto.roomNumber().trim();
            if (building.isBlank() || roomNumber.isBlank()) {
                throw new IllegalArgumentException("Building and room number are required.");
            }

            Integer floorNumber = dto.floorNumber();
            String floorName = dto.floorName() == null ? "" : dto.floorName().trim();
            if ((floorNumber == null && floorName.isBlank()) && !floor.isBlank()) {
                // Best-effort parse legacy combined label like "1 / Ground"
                java.util.regex.Matcher m = java.util.regex.Pattern.compile("^\\s*(\\d{1,3})\\s*(?:[/-]\\s*)?(.*)\\s*$").matcher(floor);
                if (m.find()) {
                    try {
                        floorNumber = Integer.valueOf(m.group(1).trim());
                    } catch (Exception ignored) {
                    }
                    floorName = m.group(2) == null ? "" : m.group(2).trim();
                } else {
                    floorName = floor;
                }
            }

            Building b = buildingRepo.findBySchool_IdAndNameIgnoreCase(schoolId, building).orElse(null);
            if (b == null) {
                b = new Building();
                b.setSchool(school);
                b.setName(building);
                b = buildingRepo.save(b);
            }

            Floor f = null;
            String floorKeyName = floorName.isBlank() ? "" : floorName;
            if (!floorKeyName.isBlank()) {
                f = floorRepo.findByBuilding_IdAndNameIgnoreCase(b.getId(), floorKeyName).orElse(null);
                if (f == null) {
                    f = new Floor();
                    f.setBuilding(b);
                    f.setName(floorKeyName);
                    f = floorRepo.save(f);
                }
            }

            // Duplicate detection: prefer building_id uniqueness, fall back to legacy building string uniqueness
            if (roomRepo.findBySchool_IdAndBuildingRef_IdAndRoomNumberIgnoreCase(schoolId, b.getId(), roomNumber).isPresent()
                    || roomRepo.findBySchool_IdAndBuildingIgnoreCaseAndRoomNumberIgnoreCase(schoolId, building, roomNumber).isPresent()) {
                skipped += 1;
                continue;
            }

            Room r = new Room();
            r.setSchool(school);
            // keep legacy column in sync for older queries + unique constraint
            r.setBuilding(building);
            r.setBuildingRef(b);
            r.setFloorRef(f);
            r.setRoomNumber(roomNumber);
            LabType labParsed = null;
            if (dto.labType() != null && !dto.labType().isBlank()) {
                try {
                    labParsed = LabType.valueOf(dto.labType().trim().toUpperCase());
                } catch (Exception ignored) {
                    labParsed = LabType.OTHER;
                }
            }
            String typeRaw = dto.type() == null ? "CLASSROOM" : dto.type().trim();
            RoomType type = RoomTypeParsing.parseRoomType(typeRaw, labParsed);
            r.setType(type);
            if (type == RoomType.SCIENCE_LAB || type == RoomType.COMPUTER_LAB) {
                if (labParsed != null) {
                    r.setLabType(labParsed);
                } else if (type == RoomType.COMPUTER_LAB) {
                    r.setLabType(LabType.COMPUTER);
                } else {
                    r.setLabType(LabType.OTHER);
                }
            } else {
                r.setLabType(null);
            }
            if (dto.capacity() != null && dto.capacity() > 0) {
                r.setCapacity(dto.capacity());
            }
            r.setFloorNumber(floorNumber);
            r.setFloorName(floorName.isBlank() ? null : floorName);
            r.setSchedulable(true);
            r.setCreatedBy(actor);
            r.setUpdatedBy(actor);
            roomRepo.save(r);
            created += 1;
            String floorDisp = r.getFloorName();
            keys.add(building + (floorDisp == null || floorDisp.isBlank() ? "" : (" / " + floorDisp)) + " / " + roomNumber);
        }

        markCompleted(school, OnboardingStatus.ROOMS);
        school.setOnboardingStatus(OnboardingStatus.STAFF);
        schoolRepo.save(school);

        return new OnboardingRoomsSetupResultDTO(created, skipped, keys);
    }

    /**
     * Skip the optional rooms step without creating rooms (e.g. configure rooms later). Advances onboarding past {@link
     * OnboardingStatus#ROOMS} to {@link OnboardingStatus#STAFF}.
     */
    @Transactional
    public void skipRoomsOnboarding() {
        Integer schoolId = requireSchoolId();
        School school = schoolRepo.findById(schoolId).orElseThrow();
        if (school.getOnboardingStatus() != OnboardingStatus.ROOMS) {
            return;
        }
        markCompleted(school, OnboardingStatus.ROOMS);
        school.setOnboardingStatus(OnboardingStatus.STAFF);
        schoolRepo.save(school);
    }

    @Transactional(readOnly = true)
    public List<OnboardingClassDefaultRoomViewDTO> listClassDefaultRooms() {
        Integer schoolId = requireSchoolId();
        return classGroupRepo.findAllBySchool_IdAndIsDeletedFalseOrderByGradeLevelAscCodeAsc(schoolId).stream()
                .map(cg -> new OnboardingClassDefaultRoomViewDTO(
                        cg.getId(),
                        cg.getCode(),
                        cg.getDisplayName(),
                        cg.getGradeLevel(),
                        cg.getSection(),
                        cg.getDefaultRoomId()))
                .toList();
    }

    @Transactional
    public void saveClassDefaultRooms(List<OnboardingClassDefaultRoomItemDTO> items) {
        Integer schoolId = requireSchoolId();
        School school = schoolRepo.findById(schoolId).orElseThrow();
        if (school.getOnboardingStatus() != OnboardingStatus.CLASS_DEFAULT_ROOMS
                && school.getOnboardingStatus() != OnboardingStatus.ACADEMIC_STRUCTURE) {
            throw new IllegalStateException(
                    "Save class default rooms is only available at the Class default rooms step or Academic structure step.");
        }
        List<OnboardingClassDefaultRoomItemDTO> rows = items == null ? List.of() : items;

        // Conflict validation: one room should not be the "default" for multiple class groups.
        java.util.Map<Integer, java.util.List<Integer>> roomToClassIds = new java.util.LinkedHashMap<>();
        for (OnboardingClassDefaultRoomItemDTO it : rows) {
            if (it == null || it.roomId() == null) continue;
            roomToClassIds.computeIfAbsent(it.roomId(), k -> new java.util.ArrayList<>()).add(it.classGroupId());
        }
        java.util.List<String> conflicts = new java.util.ArrayList<>();
        for (var e : roomToClassIds.entrySet()) {
            if (e.getValue() == null || e.getValue().size() <= 1) continue;
            Room r = roomRepo.findByIdAndSchool_Id(e.getKey(), schoolId).orElse(null);
            String roomLabel = r == null ? ("Room#" + e.getKey()) : (r.getBuilding() + " " + r.getRoomNumber());
            conflicts.add(roomLabel + " assigned to " + e.getValue().size() + " classes");
        }
        if (!conflicts.isEmpty()) {
            throw new IllegalArgumentException("Default room conflicts: " + String.join("; ", conflicts) + ".");
        }

        for (OnboardingClassDefaultRoomItemDTO it : rows) {
            ClassGroup cg = classGroupRepo.findByIdAndSchool_Id(it.classGroupId(), schoolId).orElseThrow();
            if (it.roomId() == null) {
                cg.setDefaultRoom(null);
                cg.setHomeroomSource(null);
            } else {
                Room r = roomRepo.findByIdAndSchool_Id(it.roomId(), schoolId).orElseThrow();
                cg.setDefaultRoom(r);
                if (it.homeroomSource() != null) {
                    cg.setHomeroomSource(normalizeAssignmentSource(it.homeroomSource()));
                }
            }
            classGroupRepo.save(cg);
        }
        markCompleted(school, OnboardingStatus.CLASS_DEFAULT_ROOMS);
        if (school.getOnboardingStatus() == OnboardingStatus.CLASS_DEFAULT_ROOMS) {
            school.setOnboardingStatus(OnboardingStatus.ROLES);
        }
        schoolRepo.save(school);
    }

    @Transactional
    public void completeRolesStep() {
        Integer schoolId = requireSchoolId();
        School school = schoolRepo.findById(schoolId).orElseThrow();
        markCompleted(school, OnboardingStatus.ROLES);
        if (school.getOnboardingStatus() == OnboardingStatus.ROLES) {
            school.setOnboardingStatus(OnboardingStatus.STAFF);
        }
        schoolRepo.save(school);
    }

    @Transactional
    public OnboardingStaffSetupResultDTO createStaff(List<OnboardingStaffCreateDTO> dtos) {
        Integer schoolId = requireSchoolId();
        School school = schoolRepo.findById(schoolId).orElseThrow();
        if (dtos == null || dtos.isEmpty()) {
            throw new IllegalArgumentException("At least one staff row is required.");
        }

        int staffCreated = 0;
        int usersCreated = 0;
        int skipped = 0;
        List<OnboardingStaffUserCredentialDTO> creds = new ArrayList<>();

        Set<String> seenEmails = new HashSet<>();
        Set<String> seenEmp = new HashSet<>();

        for (OnboardingStaffCreateDTO dto : dtos) {
            String email = dto.email() == null ? "" : dto.email().trim().toLowerCase(Locale.ROOT);
            if (email.isBlank()) throw new IllegalArgumentException("Staff email is required.");
            if (seenEmails.contains(email)) throw new IllegalArgumentException("Duplicate email in request: " + email);
            seenEmails.add(email);

            String phone = dto.phone() == null ? "" : dto.phone().trim();
            if (phone.isBlank()) throw new IllegalArgumentException("Staff phone is required.");
            String phoneDigits = phone.replaceAll("[^0-9]", "");
            if (phoneDigits.length() < 10 || phoneDigits.length() > 15) {
                throw new IllegalArgumentException("Invalid phone number for " + email + ". Provide 10–15 digits.");
            }

            String designation = dto.designation() == null ? "" : dto.designation().trim();
            if (designation.isBlank()) throw new IllegalArgumentException("Designation is required for " + email + ".");

            // If user already exists, treat onboarding as an update for this tenant
            // (CSV re-upload should be able to update teachable subjects / roles).
            User existingUser = userRepo.findFirstByEmailIgnoreCase(email).orElse(null);
            if (existingUser != null) {
                Integer existingSchoolId = existingUser.getSchool() == null ? null : existingUser.getSchool().getId();
                Staff linked = existingUser.getLinkedStaff();
                if (existingSchoolId != null && existingSchoolId.equals(schoolId) && linked != null && !linked.isDeleted()) {
                    // Update staff profile fields (best-effort) + teachables + roles.
                    linked.setFullName(dto.fullName() == null ? linked.getFullName() : dto.fullName().trim());
                    linked.setEmail(email);
                    linked.setPhone(phone);
                    linked.setDesignation(designation);
                    if (dto.employeeNo() != null && !dto.employeeNo().trim().isBlank()) {
                        linked.setEmployeeNo(dto.employeeNo().trim());
                    }
                    applyStaffLoadAndPrefs(linked, dto.maxWeeklyLectureLoad(), dto.preferredClassGroupIds());
                    linked.setUpdatedBy(actorEmailOrSystem());
                    staffRepo.save(linked);

                    Set<Role> roles = new HashSet<>();
                    List<String> requested = dto.roles() == null ? List.of(RoleNames.TEACHER) : dto.roles();
                    boolean isTeacher = requested.stream().anyMatch(r -> r != null && r.trim().equalsIgnoreCase(RoleNames.TEACHER));
                    if (isTeacher && (dto.teachableSubjectIds() == null || dto.teachableSubjectIds().isEmpty())) {
                        throw new IllegalArgumentException("Teachers must have at least one teachable subject: " + email);
                    }
                    // Constraint: only TEACHER role can have teachable subjects.
                    if (isTeacher) {
                        replaceTeachableForStaff(linked, dto.teachableSubjectIds(), schoolId);
                    } else {
                        replaceTeachableForStaff(linked, List.of(), schoolId);
                    }

                    for (String r : requested) {
                        if (r == null) continue;
                        String name = r.trim().toUpperCase(Locale.ROOT);
                        if (name.isBlank()) continue;
                        if (RoleNames.SUPER_ADMIN.equals(name) || RoleNames.STUDENT.equals(name) || RoleNames.PARENT.equals(name)) {
                            throw new IllegalArgumentException("Invalid role for staff onboarding: " + name);
                        }
                        Role role = roleRepo.findByName(name).stream().findFirst()
                                .orElseThrow(() -> new IllegalArgumentException("Unknown role: " + name));
                        roles.add(role);
                    }
                    if (roles.isEmpty()) {
                        Role role = roleRepo.findByName(RoleNames.TEACHER).stream().findFirst().orElseThrow();
                        roles.add(role);
                    }
                    existingUser.setRoles(roles);
                    userRepo.save(existingUser);

                    skipped += 1;
                    continue;
                }
                skipped += 1;
                continue;
            }

            // Staff profile (idempotent-ish by email / employeeNo). Revive soft-deleted row if needed
            // because (school_id, employee_no) is unique even for deleted staff.
            Staff staff = staffRepo.findFirstBySchool_IdAndEmailIgnoreCaseAndIsDeletedFalse(schoolId, email).orElse(null);
            if (staff == null) {
                // Try revive by email (may exist but deleted)
                Staff byEmailAny = staffRepo.findFirstBySchool_IdAndEmailIgnoreCase(schoolId, email).orElse(null);
                if (byEmailAny != null && byEmailAny.isDeleted()) {
                    staff = byEmailAny;
                    staff.setDeleted(false);
                }
            }
            if (staff == null) {
                String emp = dto.employeeNo() == null ? "" : dto.employeeNo().trim();
                if (!emp.isBlank()) {
                    Staff byEmpAny = staffRepo.findFirstBySchool_IdAndEmployeeNoIgnoreCase(schoolId, emp).orElse(null);
                    if (byEmpAny != null && byEmpAny.isDeleted()) {
                        // Revive by employee no (common re-upload case).
                        staff = byEmpAny;
                        staff.setDeleted(false);
                    }
                }
            }
            if (staff == null) {
                staff = new Staff();
                staff.setSchool(school);
                staff.setEmail(email);
                staff.setFullName(dto.fullName() == null ? "" : dto.fullName().trim());
                staff.setPhone(phone);
                staff.setDesignation(designation);
                String emp = dto.employeeNo() == null ? "" : dto.employeeNo().trim();
                if (emp.isBlank()) {
                    emp = "EMP-" + String.format("%04d", staffRepo.countBySchool_Id(schoolId) + 1);
                }
                String empKey = emp.trim().toLowerCase(Locale.ROOT);
                if (seenEmp.contains(empKey)) throw new IllegalArgumentException("Duplicate employeeNo in request: " + emp);
                seenEmp.add(empKey);
                if (staffRepo.countBySchool_IdAndEmployeeNoIgnoreCaseAndIsDeletedFalse(schoolId, emp) > 0) {
                    throw new IllegalArgumentException("EmployeeNo already exists: " + emp);
                }
                staff.setEmployeeNo(emp);
                // Classification defaults
                staff.setStaffType(dto.staffType() != null ? dto.staffType() : StaffType.TEACHING);
                staff.setStatus(StaffStatus.DRAFT);
                if (dto.joiningDate() != null)    staff.setJoiningDate(dto.joiningDate());
                if (dto.employmentType() != null)  staff.setEmploymentType(dto.employmentType());
                if (dto.department() != null && !dto.department().isBlank()) staff.setDepartment(dto.department().trim());
                String actor = actorEmailOrSystem();
                staff.setCreatedBy(actor);
                staff.setUpdatedBy(actor);
                applyStaffLoadAndPrefs(staff, dto.maxWeeklyLectureLoad(), dto.preferredClassGroupIds());
                staff = staffRepo.save(staff);
                staffCreated += 1;
            } else {
                // Revived or existing staff: ensure core fields are updated from CSV.
                staff.setEmail(email);
                staff.setFullName(dto.fullName() == null ? staff.getFullName() : dto.fullName().trim());
                staff.setPhone(phone);
                staff.setDesignation(designation);
                if (dto.employeeNo() != null && !dto.employeeNo().trim().isBlank()) {
                    staff.setEmployeeNo(dto.employeeNo().trim());
                }
                applyStaffLoadAndPrefs(staff, dto.maxWeeklyLectureLoad(), dto.preferredClassGroupIds());
                staff.setUpdatedBy(actorEmailOrSystem());
                staffRepo.save(staff);
            }

            // Roles
            Set<Role> roles = new HashSet<>();
            List<String> requested = dto.roles() == null ? List.of(RoleNames.TEACHER) : dto.roles();
            boolean isTeacher = requested.stream().anyMatch(r -> r != null && r.trim().equalsIgnoreCase(RoleNames.TEACHER));
            if (isTeacher && (dto.teachableSubjectIds() == null || dto.teachableSubjectIds().isEmpty())) {
                throw new IllegalArgumentException("Teachers must have at least one teachable subject: " + email);
            }

            // Constraint: only TEACHER role can have teachable subjects.
            if (isTeacher) {
                replaceTeachableForStaff(staff, dto.teachableSubjectIds(), schoolId);
            } else {
                replaceTeachableForStaff(staff, List.of(), schoolId);
            }

            for (String r : requested) {
                if (r == null) continue;
                String name = r.trim().toUpperCase(Locale.ROOT);
                if (name.isBlank()) continue;
                if (RoleNames.SUPER_ADMIN.equals(name) || RoleNames.STUDENT.equals(name) || RoleNames.PARENT.equals(name)) {
                    throw new IllegalArgumentException("Invalid role for staff onboarding: " + name);
                }
                Role role = roleRepo.findByName(name).stream().findFirst().orElseThrow(() -> new IllegalArgumentException("Unknown role: " + name));
                roles.add(role);
            }
            if (roles.isEmpty()) {
                Role role = roleRepo.findByName(RoleNames.TEACHER).stream().findFirst().orElseThrow();
                roles.add(role);
            }

            boolean createLogin = dto.createLoginAccount() == null || dto.createLoginAccount();
            if (createLogin) {
                // Multi-tenant behavior:
                // Email is globally unique in users table, so if a login exists for another school,
                // we "move" the login to this school (person changed school) instead of skipping.
                User existingByEmail = userRepo.findFirstByEmailIgnoreCase(email).orElse(null);
                if (existingByEmail != null) {
                    // Safety: NEVER call user.setLinkedStudent(null)
                    if (existingByEmail.getLinkedStudent() != null)
                        throw new IllegalArgumentException("Email " + email + " is already linked to a student account.");
                    if (existingByEmail.getLinkedGuardian() != null)
                        throw new IllegalArgumentException("Email " + email + " is already linked to a guardian account.");
                    boolean hasForbiddenRole = existingByEmail.getRoles().stream()
                            .anyMatch(r -> RoleNames.STUDENT.equalsIgnoreCase(r.getName()) || RoleNames.PARENT.equalsIgnoreCase(r.getName()));
                    if (hasForbiddenRole)
                        throw new IllegalArgumentException("User " + email + " has a STUDENT or PARENT role and cannot be linked to a staff profile.");
                    existingByEmail.setSchool(school);
                    existingByEmail.setLinkedStaff(staff);
                    existingByEmail.setRoles(roles);
                    userRepo.save(existingByEmail);
                    usersCreated += 1;
                } else {
                    String username = deriveUsername(email);
                    String tempPassword = generateTempPassword();
                    User user = new User();
                    user.setEmail(email);
                    user.setUsername(ensureUniqueUsername(username));
                    user.setPassword(passwordEncoder.encode(tempPassword));
                    user.setSchool(school);
                    user.setLinkedStaff(staff);
                    user.setRoles(roles);
                    userRepo.save(user);
                    usersCreated += 1;

                    creds.add(new OnboardingStaffUserCredentialDTO(
                            user.getEmail(),
                            user.getUsername(),
                            tempPassword,
                            user.getRoles().stream().map(Role::getName).sorted().toList()
                    ));
                }
            }
        }

        markCompleted(school, OnboardingStatus.STAFF);
        school.setOnboardingStatus(OnboardingStatus.ACADEMIC_STRUCTURE);
        schoolRepo.save(school);

        return new OnboardingStaffSetupResultDTO(staffCreated, usersCreated, skipped, creds);
    }

    @Transactional(readOnly = true)
    public List<OnboardingStaffViewDTO> listOnboardedStaff() {
        Integer schoolId = requireSchoolId();
        List<Staff> staff = staffRepo.findBySchool_IdAndIsDeletedFalseOrderByEmployeeNoAsc(schoolId);

        Map<Integer, List<String>> rolesByStaff = new HashMap<>();
        Map<Integer, User> usersByStaffId = new HashMap<>();
        for (User u : userRepo.findBySchool_IdWithProfilesOrderByEmailAsc(schoolId)) {
            if (u.getLinkedStaff() == null) continue;
            Integer sid = u.getLinkedStaff().getId();
            if (sid == null) continue;
            rolesByStaff.put(sid, u.getRoles().stream().map(Role::getName).sorted().toList());
            usersByStaffId.put(sid, u);
        }

        Map<Integer, List<String>> subjectCodesByStaff = new HashMap<>();
        for (StaffTeachableSubject st : staffTeachableSubjectRepository.findByStaff_School_Id(schoolId)) {
            Integer sid = st.getStaff() == null ? null : st.getStaff().getId();
            if (sid == null) continue;
            String code = st.getSubject() == null ? null : st.getSubject().getCode();
            if (code == null) continue;
            subjectCodesByStaff.computeIfAbsent(sid, k -> new ArrayList<>()).add(code);
        }
        for (Map.Entry<Integer, List<String>> e : subjectCodesByStaff.entrySet()) {
            e.getValue().sort(String::compareToIgnoreCase);
        }

        return staff.stream()
                .map(
                        s -> {
                            List<String> roles    = rolesByStaff.getOrDefault(s.getId(), List.of());
                            List<String> subjects = subjectCodesByStaff.getOrDefault(s.getId(), List.of());
                            boolean isActive      = s.getStatus() != null && "ACTIVE".equals(s.getStatus().name());
                            boolean isTeaching    = s.getStaffType() != null && "TEACHING".equals(s.getStaffType().name());
                            boolean hasTeacher    = roles.stream().anyMatch(r -> "TEACHER".equalsIgnoreCase(r));
                            boolean hasSubjects   = !subjects.isEmpty();
                            boolean ttEligible    = isActive && isTeaching && hasTeacher && hasSubjects;
                            List<String> reasons  = StaffService.computeIneligibilityReasons(isActive, isTeaching, hasTeacher, hasSubjects);
                            User user = usersByStaffId.get(s.getId());
                            String loginStatus = user == null ? "NOT_CREATED" : (user.isEnabled() ? "ACTIVE" : "DISABLED");
                            return new OnboardingStaffViewDTO(
                                    s.getId(),
                                    s.getFullName(),
                                    s.getEmail(),
                                    s.getPhone(),
                                    s.getEmployeeNo(),
                                    s.getDesignation(),
                                    s.getStaffType(),
                                    s.getStatus(),
                                    roles,
                                    subjects,
                                    user != null,
                                    s.getMaxWeeklyLectureLoad(),
                                    parseIntListJson(s.getPreferredClassGroupIdsJson()),
                                    ttEligible,
                                    reasons,
                                    loginStatus,
                                    s.isCanBeClassTeacher(),
                                    s.isCanTakeSubstitution(),
                                    s.getDepartment());
                        })
                .toList();
    }

    @Transactional(readOnly = true)
    public StaffDeleteInfoDTO staffDeleteInfo(Integer staffId) {
        Integer schoolId = requireSchoolId();
        Staff st = staffRepo.findByIdAndSchool_IdAndIsDeletedFalse(staffId, schoolId).orElseThrow();
        List<String> reasons = new ArrayList<>();

        long alloc = subjectAllocationRepo.countBySchool_IdAndStaff_Id(schoolId, st.getId());
        // Academic structure links are safe to clear automatically on delete.
        if (alloc > 0) reasons.add("Assigned in academic structure (" + alloc + " allocation(s)) — will be cleared on delete.");

        long tt = timetableEntryRepo.countBySchool_IdAndStaff_Id(schoolId, st.getId());
        if (tt > 0) reasons.add("Used in timetable (" + tt + " entry/entries).");

        // Only block deletion when used in timetable entries.
        boolean canDelete = tt == 0;
        return new StaffDeleteInfoDTO(canDelete, reasons);
    }

    @Transactional
    public void deleteStaff(Integer staffId) {
        Integer schoolId = requireSchoolId();
        Staff st = staffRepo.findByIdAndSchool_IdAndIsDeletedFalse(staffId, schoolId).orElseThrow();
        StaffDeleteInfoDTO info = staffDeleteInfo(staffId);
        if (!info.canDelete()) {
            throw new IllegalStateException(String.join(" ", info.reasons()));
        }

        // Clear onboarding academic-structure references (allocations/templates/overrides).
        subjectAllocationRepo.clearStaffBySchool_IdAndStaff_Id(schoolId, st.getId());
        classSubjectConfigRepo.clearStaffBySchool_IdAndStaff_Id(schoolId, st.getId());
        subjectSectionOverrideRepo.clearStaffBySchool_IdAndStaff_Id(schoolId, st.getId());

        // If a login user exists, delete it (onboarding cleanup). This avoids orphaned accounts.
        userRepo.findFirstBySchool_IdAndLinkedStaff_Id(schoolId, st.getId()).ifPresent(userRepo::delete);
        staffTeachableSubjectRepository.deleteByStaff_Id(st.getId());

        st.setDeleted(true);
        st.setUpdatedBy(actorEmailOrSystem());
        staffRepo.save(st);
    }

    @Transactional
    public OnboardingStaffUserCredentialDTO updateStaff(Integer staffId, OnboardingStaffUpdateDTO dto) {
        Integer schoolId = requireSchoolId();
        Staff staff = staffRepo.findByIdAndSchool_IdAndIsDeletedFalse(staffId, schoolId).orElseThrow();

        String email = dto.email() == null ? "" : dto.email().trim().toLowerCase(Locale.ROOT);
        if (email.isBlank()) throw new IllegalArgumentException("Staff email is required.");

        String phone = dto.phone() == null ? "" : dto.phone().trim();
        if (phone.isBlank()) throw new IllegalArgumentException("Staff phone is required.");
        String phoneDigits = phone.replaceAll("[^0-9]", "");
        if (phoneDigits.length() < 10 || phoneDigits.length() > 15) {
            throw new IllegalArgumentException("Invalid phone number for " + email + ". Provide 10–15 digits.");
        }

        String designation = dto.designation() == null ? "" : dto.designation().trim();
        if (designation.isBlank()) throw new IllegalArgumentException("Designation is required.");

        String emp = dto.employeeNo() == null ? "" : dto.employeeNo().trim();
        if (!emp.isBlank() && staffRepo.countBySchool_IdAndEmployeeNoIgnoreCaseAndIsDeletedFalse(schoolId, emp) > 0
                && !emp.equalsIgnoreCase(staff.getEmployeeNo())) {
            throw new IllegalArgumentException("EmployeeNo already exists: " + emp);
        }
        if (emp.isBlank()) emp = staff.getEmployeeNo();

        staff.setFullName(dto.fullName() == null ? staff.getFullName() : dto.fullName().trim());
        staff.setEmail(email);
        staff.setPhone(phone);
        staff.setDesignation(designation);
        staff.setEmployeeNo(emp);
        if (dto.staffType() != null)      staff.setStaffType(dto.staffType());
        if (dto.status() != null)         staff.setStatus(dto.status());
        if (dto.joiningDate() != null)    staff.setJoiningDate(dto.joiningDate());
        if (dto.employmentType() != null)  staff.setEmploymentType(dto.employmentType());
        if (dto.department() != null)     staff.setDepartment(dto.department().isBlank() ? null : dto.department().trim());
        applyStaffLoadAndPrefs(staff, dto.maxWeeklyLectureLoad(), dto.preferredClassGroupIds());
        staff.setUpdatedBy(actorEmailOrSystem());
        staffRepo.save(staff);

        List<String> requested = dto.roles() == null ? List.of(RoleNames.TEACHER) : dto.roles();
        boolean isTeacher = requested.stream().anyMatch(r -> r != null && r.trim().equalsIgnoreCase(RoleNames.TEACHER));
        if (isTeacher && (dto.teachableSubjectIds() == null || dto.teachableSubjectIds().isEmpty())) {
            throw new IllegalArgumentException("Teachers must have at least one teachable subject.");
        }
        // Constraint: only TEACHER role can have teachable subjects.
        if (isTeacher) {
            replaceTeachableForStaff(staff, dto.teachableSubjectIds(), schoolId);
        } else {
            replaceTeachableForStaff(staff, List.of(), schoolId);
        }

        // If login exists, update roles. If requested and missing, create login.
        Set<Role> roles = new HashSet<>();
        for (String r : requested) {
            if (r == null) continue;
            String name = r.trim().toUpperCase(Locale.ROOT);
            if (name.isBlank()) continue;
            if (RoleNames.SUPER_ADMIN.equals(name) || RoleNames.STUDENT.equals(name) || RoleNames.PARENT.equals(name)) {
                throw new IllegalArgumentException("Invalid role for staff onboarding: " + name);
            }
            Role role = roleRepo.findByName(name).stream().findFirst().orElseThrow(() -> new IllegalArgumentException("Unknown role: " + name));
            roles.add(role);
        }
        if (roles.isEmpty()) {
            Role role = roleRepo.findByName(RoleNames.TEACHER).stream().findFirst().orElseThrow();
            roles.add(role);
        }

        boolean createLogin = dto.createLoginAccount() == null || dto.createLoginAccount();
        User existing = userRepo.findFirstBySchool_IdAndLinkedStaff_Id(schoolId, staff.getId()).orElse(null);
        if (existing != null) {
            existing.setRoles(roles);
            userRepo.save(existing);
            return null;
        }
        if (!createLogin) return null;

        String username = deriveUsername(email);
        String tempPassword = generateTempPassword();
        School school = schoolRepo.findById(schoolId).orElseThrow();

        User existingByEmail = userRepo.findFirstByEmailIgnoreCase(email).orElse(null);
        if (existingByEmail != null) {
            // Safety: NEVER call user.setLinkedStudent(null)
            if (existingByEmail.getLinkedStudent() != null)
                throw new IllegalArgumentException("Email " + email + " is already linked to a student account.");
            if (existingByEmail.getLinkedGuardian() != null)
                throw new IllegalArgumentException("Email " + email + " is already linked to a guardian account.");
            boolean hasForbiddenRole = existingByEmail.getRoles().stream()
                    .anyMatch(r -> RoleNames.STUDENT.equalsIgnoreCase(r.getName()) || RoleNames.PARENT.equalsIgnoreCase(r.getName()));
            if (hasForbiddenRole)
                throw new IllegalArgumentException("User " + email + " has a STUDENT or PARENT role and cannot be linked to a staff profile.");
            existingByEmail.setSchool(school);
            existingByEmail.setLinkedStaff(staff);
            existingByEmail.setRoles(roles);
            userRepo.save(existingByEmail);
            return null;
        }

        User user = new User();
        user.setEmail(email);
        user.setUsername(ensureUniqueUsername(username));
        user.setPassword(passwordEncoder.encode(tempPassword));
        user.setSchool(school);
        user.setLinkedStaff(staff);
        user.setRoles(roles);
        userRepo.save(user);
        return new OnboardingStaffUserCredentialDTO(
                user.getEmail(),
                user.getUsername(),
                tempPassword,
                user.getRoles().stream().map(Role::getName).sorted().toList()
        );
    }

    /**
     * Sets a fresh temporary password for an existing staff-linked login. The plaintext is returned once for admin handoff.
     */
    @Transactional
    public OnboardingStaffUserCredentialDTO resetStaffLoginPassword(Integer staffId) {
        Integer schoolId = requireSchoolId();
        staffRepo.findByIdAndSchool_IdAndIsDeletedFalse(staffId, schoolId).orElseThrow();
        User user = userRepo.findFirstBySchool_IdAndLinkedStaff_Id(schoolId, staffId).orElseThrow(() ->
                new IllegalArgumentException("This staff member has no login account. Enable login from Edit staff first."));
        String tempPassword = generateTempPassword();
        user.setPassword(passwordEncoder.encode(tempPassword));
        userRepo.save(user);
        return new OnboardingStaffUserCredentialDTO(
                user.getEmail(),
                user.getUsername(),
                tempPassword,
                user.getRoles().stream().map(Role::getName).sorted().toList());
    }

    // ── Structured onboarding (StaffOnboardingRequest) ─────────────────────────

    /** Delegate to StaffService — exposes staff profile from the onboarding controller. */
    @Transactional(readOnly = true)
    public com.myhaimi.sms.DTO.staff.StaffProfileDTO getStaffProfile(Integer staffId) {
        return staffService.getById(staffId);
    }

    /**
     * Create a single staff member from a structured {@link StaffOnboardingRequest}.
     * Returns a full {@link StaffProfileDTO} with computed fields and, optionally
     * wrapped in a {@link StaffOnboardingResult} that also carries warnings and a
     * one-time temp password.
     */
    @Transactional
    public StaffOnboardingResult onboardStaff(StaffOnboardingRequest req) {
        Integer schoolId = requireSchoolId();
        School  school   = schoolRepo.findById(schoolId).orElseThrow();
        String  actor    = actorEmailOrSystem();

        // ── 1. Extract sections  ───────────────────────────────��───────────────
        var id   = req.getIdentity();
        var emp  = req.getEmployment();
        var rac  = req.getRolesAndAccess();
        var ac   = req.getAcademicCapabilities();
        var con  = req.getContact();
        var qual = req.getQualification();
        var pay  = req.getPayrollSetup();

        // ── 2. Normalise / validate ────────────────────────────────────────────
        String email    = id.getEmail()    == null ? null : id.getEmail().trim().toLowerCase(Locale.ROOT);
        String phone    = id.getPhone()    == null ? "" : id.getPhone().trim();
        if (phone.isBlank()) throw new IllegalArgumentException("Phone number is required.");
        String phoneDigits = phone.replaceAll("[^0-9]", "");
        if (phoneDigits.length() < 10 || phoneDigits.length() > 15)
            throw new IllegalArgumentException("Invalid phone number. Provide 10–15 digits.");

        if (rac.isCreateLoginAccount() && (email == null || email.isBlank()))
            throw new IllegalArgumentException("Email is required to create a login account.");

        if (emp.getStatus() == com.myhaimi.sms.entity.enums.StaffStatus.ACTIVE && emp.getJoiningDate() == null)
            throw new IllegalArgumentException("Joining date is required before a staff member can be activated.");

        // ── 3. Resolve roles ───────────────────────────────────────────────────
        List<String> requestedRoles = rac.getRoles() == null ? List.of() : rac.getRoles();
        Set<Role> roleEntities = new HashSet<>();
        for (String r : requestedRoles) {
            if (r == null || r.isBlank()) continue;
            String name = r.trim().toUpperCase(Locale.ROOT);
            if (RoleNames.SUPER_ADMIN.equals(name) || RoleNames.STUDENT.equals(name) || RoleNames.PARENT.equals(name))
                throw new IllegalArgumentException("Role not permitted for staff: " + name);
            roleEntities.add(roleRepo.findByName(name).stream().findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("Unknown role: " + name)));
        }

        // ── 4. Build warnings (non-fatal) ──────────────────────────────────────
        List<String> warnings = new ArrayList<>();
        boolean isTeaching   = emp.getStaffType() == StaffType.TEACHING;
        boolean hasTeacherRole = requestedRoles.stream()
                .anyMatch(r -> r != null && RoleNames.TEACHER.equalsIgnoreCase(r.trim()));
        List<Integer> subjectIds = ac == null ? null : ac.getTeachableSubjectIds();
        if (isTeaching && !hasTeacherRole)
            warnings.add("TEACHER role is recommended for TEACHING staff to enable timetable assignment.");
        if (hasTeacherRole && (subjectIds == null || subjectIds.isEmpty()))
            warnings.add("At least one teachable subject should be assigned for timetable eligibility.");

        // ── 5. Find or create staff row ────────────────────────────────────────
        Staff staff = null;
        if (email != null && !email.isBlank()) {
            staff = staffRepo.findFirstBySchool_IdAndEmailIgnoreCaseAndIsDeletedFalse(schoolId, email).orElse(null);
            if (staff == null) {
                Staff byEmailAny = staffRepo.findFirstBySchool_IdAndEmailIgnoreCase(schoolId, email).orElse(null);
                if (byEmailAny != null && byEmailAny.isDeleted()) { staff = byEmailAny; staff.setDeleted(false); }
            }
        }
        String empNo = id.getEmployeeNo() == null ? "" : id.getEmployeeNo().trim();
        if (staff == null && !empNo.isBlank()) {
            Staff byEmp = staffRepo.findFirstBySchool_IdAndEmployeeNoIgnoreCase(schoolId, empNo).orElse(null);
            if (byEmp != null && byEmp.isDeleted()) { staff = byEmp; staff.setDeleted(false); }
        }
        if (staff == null) {
            if (empNo.isBlank()) {
                empNo = "EMP-" + String.format("%04d", staffRepo.countBySchool_Id(schoolId) + 1);
            }
            if (staffRepo.countBySchool_IdAndEmployeeNoIgnoreCaseAndIsDeletedFalse(schoolId, empNo) > 0)
                throw new IllegalArgumentException("Employee No already exists: " + empNo);
            staff = new Staff();
            staff.setSchool(school);
            staff.setEmployeeNo(empNo);
            staff.setCreatedBy(actor);
        } else if (!empNo.isBlank()) {
            // Keep existing empNo unless explicitly changed and unique
            if (!empNo.equalsIgnoreCase(staff.getEmployeeNo())
                    && staffRepo.countBySchool_IdAndEmployeeNoIgnoreCaseAndIsDeletedFalse(schoolId, empNo) > 0)
                throw new IllegalArgumentException("Employee No already exists: " + empNo);
            if (!empNo.equalsIgnoreCase(staff.getEmployeeNo())) staff.setEmployeeNo(empNo);
        }

        // ── 6. Apply all fields from request sections ──────────────────────────
        applyIdentity(staff, id, phone, email);
        applyEmployment(staff, emp);
        if (ac   != null) applyAcademicCapabilities(staff, ac);
        if (con  != null) applyContact(staff, con);
        if (qual != null) applyQualification(staff, qual);
        if (pay  != null) applyPayroll(staff, pay);

        staff.setUpdatedBy(actor);
        staff = staffRepo.save(staff);

        // ── 6.5. Persist first-class staff role mappings ──────────────────────
        // StaffRoleMapping is the authoritative source for staff roles.
        // Roles exist independently of any portal login account.
        final Staff savedStaff = staff;
        staffRoleMappingRepository.deleteByStaff_Id(savedStaff.getId());
        for (Role role : roleEntities) {
            staffRoleMappingRepository.save(new StaffRoleMapping(savedStaff, role));
        }

        // ── 7. Teachable subjects ──────────────────────────────────────────────
        if (hasTeacherRole && subjectIds != null && !subjectIds.isEmpty()) {
            replaceTeachableForStaff(staff, subjectIds, schoolId);
        } else if (!hasTeacherRole) {
            replaceTeachableForStaff(staff, List.of(), schoolId);
        }

        // ── 8. Login account ──────────────────────────────────────────────────
        // Safety: NEVER call user.setLinkedStudent(null).
        // Reject linking an email that already belongs to a student/guardian user.
        String tempPassword = null;
        if (rac.isCreateLoginAccount() && email != null && !email.isBlank()) {
            User existingUser = userRepo.findFirstBySchool_IdAndLinkedStaff_Id(schoolId, staff.getId()).orElse(null);
            if (existingUser != null) {
                existingUser.setRoles(roleEntities);
                userRepo.save(existingUser);
            } else {
                User existingByEmail = userRepo.findFirstByEmailIgnoreCase(email).orElse(null);
                if (existingByEmail != null) {
                    // Hard safety guards
                    if (existingByEmail.getLinkedStudent() != null)
                        throw new IllegalArgumentException(
                                "Email " + email + " is already linked to a student account. Use a separate email for staff login.");
                    if (existingByEmail.getLinkedGuardian() != null)
                        throw new IllegalArgumentException(
                                "Email " + email + " is already linked to a guardian account. Use a separate email for staff login.");
                    boolean hasForbiddenRole = existingByEmail.getRoles().stream()
                            .anyMatch(r -> RoleNames.STUDENT.equalsIgnoreCase(r.getName())
                                    || RoleNames.PARENT.equalsIgnoreCase(r.getName()));
                    if (hasForbiddenRole)
                        throw new IllegalArgumentException(
                                "User " + email + " has a STUDENT or PARENT role and cannot be linked to a staff profile.");
                    if (existingByEmail.getSchool() != null && !existingByEmail.getSchool().getId().equals(schoolId))
                        throw new IllegalArgumentException("User " + email + " belongs to a different school.");
                    if (existingByEmail.getLinkedStaff() != null && !existingByEmail.getLinkedStaff().getId().equals(staff.getId()))
                        throw new IllegalArgumentException("User " + email + " is already linked to a different staff member.");
                    existingByEmail.setSchool(school);
                    existingByEmail.setLinkedStaff(staff);
                    existingByEmail.setRoles(roleEntities);
                    userRepo.save(existingByEmail);
                } else {
                    tempPassword = generateTempPassword();
                    String preferredUsername = rac.getUsername();
                    String username = preferredUsername != null && !preferredUsername.isBlank()
                            ? ensureUniqueUsername(preferredUsername.trim())
                            : ensureUniqueUsername(deriveUsername(email));
                    User user = new User();
                    user.setEmail(email);
                    user.setUsername(username);
                    user.setPassword(passwordEncoder.encode(tempPassword));
                    user.setSchool(school);
                    user.setLinkedStaff(staff);
                    user.setRoles(roleEntities);
                    userRepo.save(user);
                }
            }
        } else if (!roleEntities.isEmpty()) {
            // Still update roles on any existing login even if createLoginAccount=false
            userRepo.findFirstBySchool_IdAndLinkedStaff_Id(schoolId, staff.getId()).ifPresent(u -> {
                u.setRoles(roleEntities);
                userRepo.save(u);
            });
        }

        // ── 9. Seed document checklist ─────────────────────────────────────────
        staffDocumentService.seedDocuments(staff.getId());

        // ── 10. Build response ─────────────────────────────────────────────────
        StaffProfileDTO profile = staffService.getById(staff.getId());
        return new StaffOnboardingResult(profile, warnings, tempPassword);
    }

    /**
     * Update an existing staff record using the structured request.
     * Only sections present in the request body are applied; null sections are skipped.
     */
    @Transactional
    public StaffOnboardingResult updateStaffOnboarding(Integer staffId, StaffOnboardingRequest req) {
        Integer schoolId = requireSchoolId();
        Staff staff = staffRepo.findByIdAndSchool_IdAndIsDeletedFalse(staffId, schoolId)
                .orElseThrow(() -> new IllegalArgumentException("Staff not found."));

        var id   = req.getIdentity();
        var emp  = req.getEmployment();
        var rac  = req.getRolesAndAccess();
        var ac   = req.getAcademicCapabilities();
        var con  = req.getContact();
        var qual = req.getQualification();
        var pay  = req.getPayrollSetup();

        String email = id.getEmail() == null ? null : id.getEmail().trim().toLowerCase(Locale.ROOT);
        String phone = id.getPhone() == null ? "" : id.getPhone().trim();
        if (phone.isBlank()) throw new IllegalArgumentException("Phone number is required.");
        String phoneDigits = phone.replaceAll("[^0-9]", "");
        if (phoneDigits.length() < 10 || phoneDigits.length() > 15)
            throw new IllegalArgumentException("Invalid phone number. Provide 10–15 digits.");

        if (rac.isCreateLoginAccount() && (email == null || email.isBlank()))
            throw new IllegalArgumentException("Email is required to create a login account.");

        if (emp.getStatus() == com.myhaimi.sms.entity.enums.StaffStatus.ACTIVE && emp.getJoiningDate() == null
                && staff.getJoiningDate() == null)
            throw new IllegalArgumentException("Joining date is required before activating staff.");

        // EmployeeNo update
        String empNo = id.getEmployeeNo() == null ? "" : id.getEmployeeNo().trim();
        if (!empNo.isBlank() && !empNo.equalsIgnoreCase(staff.getEmployeeNo())) {
            if (staffRepo.countBySchool_IdAndEmployeeNoIgnoreCaseAndIsDeletedFalse(schoolId, empNo) > 0)
                throw new IllegalArgumentException("Employee No already exists: " + empNo);
            staff.setEmployeeNo(empNo);
        }

        applyIdentity(staff, id, phone, email);
        applyEmployment(staff, emp);
        if (ac   != null) applyAcademicCapabilities(staff, ac);
        if (con  != null) applyContact(staff, con);
        if (qual != null) applyQualification(staff, qual);
        if (pay  != null) applyPayroll(staff, pay);

        // Roles and teachable subjects
        List<String> requestedRoles = rac.getRoles() == null ? List.of() : rac.getRoles();
        Set<Role> roleEntities = new HashSet<>();
        for (String r : requestedRoles) {
            if (r == null || r.isBlank()) continue;
            String name = r.trim().toUpperCase(Locale.ROOT);
            if (RoleNames.SUPER_ADMIN.equals(name) || RoleNames.STUDENT.equals(name) || RoleNames.PARENT.equals(name))
                throw new IllegalArgumentException("Role not permitted for staff: " + name);
            roleEntities.add(roleRepo.findByName(name).stream().findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("Unknown role: " + name)));
        }

        // Save roles as first-class StaffRoleMapping (authoritative; independent of login account)
        staffRoleMappingRepository.deleteByStaff_Id(staff.getId());
        for (Role role : roleEntities) {
            staffRoleMappingRepository.save(new StaffRoleMapping(staff, role));
        }

        staff.setUpdatedBy(actorEmailOrSystem());
        staff = staffRepo.save(staff);

        List<String> warnings      = new ArrayList<>();
        boolean isTeaching         = emp.getStaffType() == StaffType.TEACHING;
        boolean hasTeacherRole     = requestedRoles.stream().anyMatch(r -> r != null && RoleNames.TEACHER.equalsIgnoreCase(r.trim()));
        List<Integer> subjectIds   = ac == null ? null : ac.getTeachableSubjectIds();

        if (isTeaching && !hasTeacherRole) warnings.add("TEACHER role is recommended for TEACHING staff.");
        if (hasTeacherRole && (subjectIds == null || subjectIds.isEmpty()))
            warnings.add("At least one teachable subject should be assigned for timetable eligibility.");

        if (hasTeacherRole && subjectIds != null) replaceTeachableForStaff(staff, subjectIds, schoolId);
        else if (!hasTeacherRole)                  replaceTeachableForStaff(staff, List.of(), schoolId);

        // Login account — Safety: NEVER call user.setLinkedStudent(null).
        String tempPassword = null;
        School school = schoolRepo.findById(schoolId).orElseThrow();
        if (rac.isCreateLoginAccount() && email != null && !email.isBlank()) {
            User existing = userRepo.findFirstBySchool_IdAndLinkedStaff_Id(schoolId, staff.getId()).orElse(null);
            if (existing != null) {
                existing.setRoles(roleEntities);
                userRepo.save(existing);
            } else {
                User existingByEmail = userRepo.findFirstByEmailIgnoreCase(email).orElse(null);
                if (existingByEmail != null) {
                    // Hard safety guards
                    if (existingByEmail.getLinkedStudent() != null)
                        throw new IllegalArgumentException(
                                "Email " + email + " is already linked to a student account. Use a separate email for staff login.");
                    if (existingByEmail.getLinkedGuardian() != null)
                        throw new IllegalArgumentException(
                                "Email " + email + " is already linked to a guardian account. Use a separate email for staff login.");
                    boolean hasForbiddenRole = existingByEmail.getRoles().stream()
                            .anyMatch(r -> RoleNames.STUDENT.equalsIgnoreCase(r.getName())
                                    || RoleNames.PARENT.equalsIgnoreCase(r.getName()));
                    if (hasForbiddenRole)
                        throw new IllegalArgumentException(
                                "User " + email + " has a STUDENT or PARENT role and cannot be linked to a staff profile.");
                    if (existingByEmail.getSchool() != null && !existingByEmail.getSchool().getId().equals(schoolId))
                        throw new IllegalArgumentException("User " + email + " belongs to a different school.");
                    if (existingByEmail.getLinkedStaff() != null && !existingByEmail.getLinkedStaff().getId().equals(staff.getId()))
                        throw new IllegalArgumentException("User " + email + " is already linked to a different staff member.");
                    existingByEmail.setSchool(school); existingByEmail.setLinkedStaff(staff);
                    existingByEmail.setRoles(roleEntities);
                    userRepo.save(existingByEmail);
                } else {
                    tempPassword = generateTempPassword();
                    User user = new User();
                    user.setEmail(email);
                    user.setUsername(ensureUniqueUsername(deriveUsername(email)));
                    user.setPassword(passwordEncoder.encode(tempPassword));
                    user.setSchool(school); user.setLinkedStaff(staff); user.setRoles(roleEntities);
                    userRepo.save(user);
                }
            }
        } else {
            userRepo.findFirstBySchool_IdAndLinkedStaff_Id(schoolId, staff.getId()).ifPresent(u -> {
                u.setRoles(roleEntities); userRepo.save(u);
            });
        }

        // Seed document checklist (idempotent — only creates missing rows)
        staffDocumentService.seedDocuments(staff.getId());

        StaffProfileDTO profile = staffService.getById(staff.getId());
        return new StaffOnboardingResult(profile, warnings, tempPassword);
    }

    // ── Private field-application helpers ─────────────────────────────────────

    private void applyIdentity(Staff s, com.myhaimi.sms.DTO.staff.onboarding.StaffIdentityDTO id,
                                String normalizedPhone, String normalizedEmail) {
        if (id.getFullName() != null) s.setFullName(id.getFullName().trim());
        s.setPhone(normalizedPhone);
        if (normalizedEmail != null) s.setEmail(normalizedEmail);
        if (id.getGender()       != null) s.setGender(id.getGender().trim());
        if (id.getDateOfBirth()  != null) s.setDateOfBirth(id.getDateOfBirth());
        if (id.getPhotoUrl()     != null) s.setPhotoUrl(id.getPhotoUrl().trim());
        if (id.getAlternatePhone() != null) s.setAlternatePhone(id.getAlternatePhone().trim());
    }

    private void applyEmployment(Staff s, com.myhaimi.sms.DTO.staff.onboarding.StaffEmploymentDTO emp) {
        if (emp.getStaffType()    != null) s.setStaffType(emp.getStaffType());
        if (emp.getStatus()       != null) s.setStatus(emp.getStatus());
        if (emp.getDesignation()  != null) s.setDesignation(emp.getDesignation().trim());
        if (emp.getDepartment()   != null) s.setDepartment(emp.getDepartment().isBlank() ? null : emp.getDepartment().trim());
        if (emp.getJoiningDate()  != null) s.setJoiningDate(emp.getJoiningDate());
        if (emp.getEmploymentType() != null) s.setEmploymentType(emp.getEmploymentType());
        if (emp.getReportingManagerStaffId() != null) s.setReportingManagerStaffId(emp.getReportingManagerStaffId());
    }

    private void applyAcademicCapabilities(Staff s, com.myhaimi.sms.DTO.staff.onboarding.StaffAcademicCapabilitiesDTO ac) {
        if (ac.getMaxWeeklyLectureLoad() != null) s.setMaxWeeklyLectureLoad(ac.getMaxWeeklyLectureLoad());
        if (ac.getMaxDailyLectureLoad()  != null) s.setMaxDailyLectureLoad(ac.getMaxDailyLectureLoad());
        if (ac.getCanBeClassTeacher()    != null) s.setCanBeClassTeacher(ac.getCanBeClassTeacher());
        if (ac.getCanTakeSubstitution()  != null) s.setCanTakeSubstitution(ac.getCanTakeSubstitution());
        try {
            if (ac.getPreferredClassGroupIds() != null && !ac.getPreferredClassGroupIds().isEmpty()) {
                s.setPreferredClassGroupIdsJson(objectMapper.writeValueAsString(ac.getPreferredClassGroupIds()));
            }
            if (ac.getRestrictedClassGroupIds() != null) {
                s.setRestrictedClassGroupIdsJson(
                    ac.getRestrictedClassGroupIds().isEmpty() ? null
                        : objectMapper.writeValueAsString(ac.getRestrictedClassGroupIds()));
            }
        } catch (Exception e) { throw new IllegalArgumentException("Could not store class group ids", e); }
        // Unavailable periods: store as-is (opaque JSON placeholder — not yet validated by scheduler)
        if (ac.getUnavailablePeriodsJson() != null) {
            s.setUnavailablePeriodsJson(ac.getUnavailablePeriodsJson().isBlank() ? null : ac.getUnavailablePeriodsJson());
        }
    }

    private void applyContact(Staff s, com.myhaimi.sms.DTO.staff.onboarding.StaffContactDTO c) {
        if (c.getCurrentAddressLine1()    != null) s.setCurrentAddressLine1(c.getCurrentAddressLine1().trim());
        if (c.getCurrentAddressLine2()    != null) s.setCurrentAddressLine2(c.getCurrentAddressLine2().trim());
        if (c.getCity()                   != null) s.setCity(c.getCity().trim());
        if (c.getState()                  != null) s.setState(c.getState().trim());
        if (c.getPincode()                != null) s.setPincode(c.getPincode().trim());
        if (c.getEmergencyContactName()   != null) s.setEmergencyContactName(c.getEmergencyContactName().trim());
        if (c.getEmergencyContactPhone()  != null) s.setEmergencyContactPhone(c.getEmergencyContactPhone().trim());
        if (c.getEmergencyContactRelation() != null) s.setEmergencyContactRelation(c.getEmergencyContactRelation().trim());
    }

    private void applyQualification(Staff s, com.myhaimi.sms.DTO.staff.onboarding.StaffQualificationDTO q) {
        if (q.getHighestQualification()      != null) s.setHighestQualification(q.getHighestQualification().trim());
        if (q.getProfessionalQualification() != null) s.setProfessionalQualification(q.getProfessionalQualification().trim());
        if (q.getSpecialization()            != null) s.setSpecialization(q.getSpecialization().trim());
        if (q.getYearsOfExperience()         != null) s.setYearsOfExperience(q.getYearsOfExperience());
        if (q.getPreviousInstitution()       != null) s.setPreviousInstitution(q.getPreviousInstitution().trim());
    }

    private void applyPayroll(Staff s, com.myhaimi.sms.DTO.staff.onboarding.StaffPayrollSetupDTO p) {
        s.setPayrollEnabled(p.isPayrollEnabled());
        if (p.getSalaryType()             != null) s.setSalaryType(p.getSalaryType());
        if (p.getBankAccountHolderName()  != null) s.setBankAccountHolderName(p.getBankAccountHolderName().trim());
        if (p.getBankName()               != null) s.setBankName(p.getBankName().trim());
        if (p.getBankAccountNumber()      != null) s.setBankAccountNumber(p.getBankAccountNumber().trim());
        if (p.getIfsc()                   != null) s.setIfsc(p.getIfsc().trim().toUpperCase(Locale.ROOT));
        if (p.getPanNumber()              != null) s.setPanNumber(p.getPanNumber().trim().toUpperCase(Locale.ROOT));
    }

    @Transactional
    public void saveFees(OnboardingFeesSetupDTO dto) {
        Integer schoolId = requireSchoolId();
        School school = schoolRepo.findById(schoolId).orElseThrow();
        // validate percent sum
        int sum = dto.installments().stream().mapToInt(OnboardingFeesSetupDTO.InstallmentDTO::percent).sum();
        if (sum != 100) {
            throw new IllegalArgumentException("Installment percents must sum to 100 (got " + sum + ").");
        }
        try {
            school.setOnboardingFeesJson(objectMapper.writeValueAsString(dto));
        } catch (Exception e) {
            throw new IllegalArgumentException("Could not serialize onboarding fees setup");
        }
        markCompleted(school, OnboardingStatus.FEES);
        school.setOnboardingStatus(OnboardingStatus.NOTIFICATIONS);
        schoolRepo.save(school);
    }

    @Transactional(readOnly = true)
    public OnboardingFeesSetupDTO fees() {
        Integer schoolId = requireSchoolId();
        School school = schoolRepo.findById(schoolId).orElseThrow();
        if (school.getOnboardingFeesJson() == null || school.getOnboardingFeesJson().isBlank()) return null;
        try {
            return objectMapper.readValue(school.getOnboardingFeesJson(), OnboardingFeesSetupDTO.class);
        } catch (Exception e) {
            throw new IllegalStateException("Could not read onboarding fees setup");
        }
    }

    @Transactional
    public OnboardingStudentsSetupResultDTO createStudents(List<OnboardingStudentCreateDTO> dtos) {
        Integer schoolId = requireSchoolId();
        School school = schoolRepo.findById(schoolId).orElseThrow();
        if (dtos == null || dtos.isEmpty()) {
            throw new IllegalArgumentException("At least one student row is required.");
        }

        int studentsCreated = 0;
        int guardiansCreated = 0;
        int skipped = 0;

        for (OnboardingStudentCreateDTO dto : dtos) {
            String admissionNo = dto.admissionNo() == null ? "" : dto.admissionNo().trim();
            String firstName = dto.firstName() == null ? "" : dto.firstName().trim();
            String lastName = dto.lastName() == null ? null : dto.lastName().trim();
            if (admissionNo.isBlank() || firstName.isBlank()) {
                throw new IllegalArgumentException("Admission no and first name are required.");
            }
            if (studentRepo.findBySchool_IdAndAdmissionNo(schoolId, admissionNo).isPresent()) {
                skipped += 1;
                continue;
            }

            String gPreview = dto.guardianName() == null ? "" : dto.guardianName().trim();
            if (gPreview.isBlank()) {
                throw new IllegalArgumentException("Guardian name is required for each student row.");
            }

            Student s = new Student();
            s.setSchool(school);
            s.setAdmissionNo(admissionNo);
            s.setFirstName(firstName);
            s.setLastName((lastName == null || lastName.isBlank()) ? null : lastName);

            ClassGroup cg = null;
            if (dto.classGroupId() != null) {
                cg = classGroupRepo.findByIdAndSchool_Id(dto.classGroupId(), schoolId).orElseThrow();
            } else if (dto.classGroupCode() != null && !dto.classGroupCode().isBlank()) {
                String code = dto.classGroupCode().trim().toUpperCase();
                cg = classGroupRepo.findByCodeAndSchool_Id(code, schoolId).orElse(null);
            }
            if (cg == null) {
                throw new IllegalArgumentException(
                        "Class group (id or code) is required for each student row (" + admissionNo + ").");
            }
            s.setClassGroup(cg);

            Student saved = studentRepo.save(s);
            studentsCreated += 1;

            AcademicYear ay = academicYearRepo
                    .findFirstBySchool_Id(schoolId, Sort.by(Sort.Direction.DESC, "startsOn", "id"))
                    .orElseGet(() -> academicYearRepo.save(rollingAcademicYear(school)));

            StudentAcademicEnrollment en = new StudentAcademicEnrollment();
            en.setStudent(saved);
            en.setAcademicYear(ay);
            en.setClassGroup(cg);
            en.setAdmissionDate(LocalDate.now());
            en.setJoiningDate(LocalDate.now());
            en.setStatus(StudentAcademicEnrollmentStatus.ACTIVE);
            studentAcademicEnrollmentRepo.save(en);

            Guardian g = new Guardian();
            g.setSchool(school);
            g.setName(gPreview);
            String phone =
                    dto.guardianPhone() != null && !dto.guardianPhone().isBlank()
                            ? dto.guardianPhone().trim()
                            : "-";
            g.setPhone(phone);
            if (dto.guardianEmail() != null && !dto.guardianEmail().isBlank()) {
                g.setEmail(dto.guardianEmail().trim());
            }
            guardianRepo.save(g);

            String rel =
                    dto.guardianRelation() != null && !dto.guardianRelation().isBlank()
                            ? dto.guardianRelation().trim()
                            : "Parent";
            StudentGuardian sg = new StudentGuardian();
            sg.setStudent(saved);
            sg.setGuardian(g);
            sg.setRelation(rel);
            sg.setPrimaryGuardian(true);
            sg.setCanLogin(false);
            sg.setReceivesNotifications(true);
            studentGuardianRepo.save(sg);

            guardiansCreated += 1;
        }

        markCompleted(school, OnboardingStatus.STUDENTS);
        if (school.getOnboardingStatus() == OnboardingStatus.STUDENTS) {
            school.setOnboardingStatus(OnboardingStatus.FEES);
        }
        schoolRepo.save(school);

        return new OnboardingStudentsSetupResultDTO(studentsCreated, guardiansCreated, skipped);
    }

    private AcademicYear rollingAcademicYear(School school) {
        LocalDate today = LocalDate.now();
        int startY = today.getMonthValue() >= 4 ? today.getYear() : today.getYear() - 1;
        int endY = startY + 1;
        AcademicYear ay = new AcademicYear();
        ay.setSchool(school);
        ay.setLabel(startY + "-" + endY);
        ay.setStartsOn(LocalDate.of(startY, 4, 1));
        ay.setEndsOn(LocalDate.of(endY, 3, 31));
        return ay;
    }

    @Transactional(readOnly = true)
    public OnboardingAcademicStructureViewDTO listAcademicStructure() {
        Integer schoolId = requireSchoolId();
        School school = schoolRepo.findById(schoolId).orElseThrow();
        List<OnboardingAcademicSlotMetaDTO> slotMeta = List.of();
        if (school.getOnboardingAcademicAssignmentMetaJson() != null
                && !school.getOnboardingAcademicAssignmentMetaJson().isBlank()) {
            try {
                slotMeta = objectMapper.readValue(
                        school.getOnboardingAcademicAssignmentMetaJson(), SLOT_META_LIST);
            } catch (Exception ignored) {
                slotMeta = List.of();
            }
        }
        List<Subject> subjects = subjectRepo.findBySchool_IdAndIsDeletedFalseOrderByCodeAsc(schoolId);
        List<OnboardingAcademicSubjectItemDTO> sRows =
                subjects.stream()
                        .map(s -> new OnboardingAcademicSubjectItemDTO(
                                s.getId(), s.getCode(), s.getName(), s.getWeeklyFrequency()))
                        .toList();

        // Normalize by code so staff teachables keep working even if a subject row was recreated/revived.
        java.util.Map<String, Integer> activeSubjectIdByCode = new java.util.HashMap<>();
        for (Subject s : subjects) {
            if (s.getCode() == null) continue;
            String code = s.getCode().trim().toUpperCase(java.util.Locale.ROOT);
            if (!code.isBlank()) activeSubjectIdByCode.put(code, s.getId());
        }
        java.util.Map<Integer, String> anySubjectCodeById = new java.util.HashMap<>();
        for (Subject s : subjectRepo.findBySchool_IdOrderByCodeAsc(schoolId)) {
            if (s.getCode() == null) continue;
            String code = s.getCode().trim().toUpperCase(java.util.Locale.ROOT);
            if (!code.isBlank()) anySubjectCodeById.put(s.getId(), code);
        }

        List<Staff> staff = staffRepo.findBySchool_IdOrderByEmployeeNoAsc(schoolId);
        List<StaffTeachableSubject> allTeachable = staffTeachableSubjectRepository.findByStaff_School_Id(schoolId);
        java.util.Map<Integer, List<Integer>> teachableByStaff = new java.util.HashMap<>();
        for (StaffTeachableSubject t : allTeachable) {
            if (t.getStaff() == null || t.getSubject() == null) continue;
            String rawCode = t.getSubject().getCode();
            if (rawCode == null || rawCode.isBlank()) continue;
            Integer activeId = activeSubjectIdByCode.get(rawCode.trim().toUpperCase(java.util.Locale.ROOT));
            if (activeId == null) continue;
            teachableByStaff
                    .computeIfAbsent(t.getStaff().getId(), k -> new java.util.ArrayList<>())
                    .add(activeId);
        }
        java.util.Map<Integer, List<String>> roleNamesByStaff = new java.util.HashMap<>();
        for (User u : userRepo.findBySchool_IdWithProfilesOrderByEmailAsc(schoolId)) {
            if (u.getLinkedStaff() == null) continue;
            roleNamesByStaff.put(
                    u.getLinkedStaff().getId(),
                    u.getRoles().stream().map(Role::getName).sorted().toList());
        }
        List<OnboardingAcademicStaffItemDTO> stRows = staff.stream()
                .map(st -> {
                    List<String> stRoles       = roleNamesByStaff.getOrDefault(st.getId(), List.of());
                    List<Integer> stSubjectIds = teachableByStaff.getOrDefault(st.getId(), List.of());
                    boolean stActive      = st.getStatus() != null && "ACTIVE".equals(st.getStatus().name());
                    boolean stTeaching    = st.getStaffType() != null && "TEACHING".equals(st.getStaffType().name());
                    boolean stHasTeacher  = stRoles.stream().anyMatch(r -> "TEACHER".equalsIgnoreCase(r));
                    boolean stHasSubjects = !stSubjectIds.isEmpty();
                    boolean stEligible    = stActive && stTeaching && stHasTeacher && stHasSubjects;
                    List<String> stReasons = StaffService.computeIneligibilityReasons(stActive, stTeaching, stHasTeacher, stHasSubjects);
                    return new OnboardingAcademicStaffItemDTO(
                            st.getId(),
                            st.getFullName(),
                            st.getEmail(),
                            stSubjectIds,
                            stRoles,
                            st.getMaxWeeklyLectureLoad(),
                            parseIntListJson(st.getPreferredClassGroupIdsJson()),
                            st.getStaffType(),
                            st.getStatus(),
                            st.isCanBeClassTeacher(),
                            st.isCanTakeSubstitution(),
                            stEligible,
                            stReasons);
                })
                .toList();

        List<OnboardingAcademicClassGroupItemDTO> cgRows = classGroupRepo
                .findAllBySchool_IdAndIsDeletedFalseOrderByGradeLevelAscCodeAsc(schoolId)
                .stream()
                .map(cg -> new OnboardingAcademicClassGroupItemDTO(
                        cg.getId(),
                        cg.getCode(),
                        cg.getDisplayName(),
                        cg.getGradeLevel(),
                        cg.getSection(),
                        cg.getDefaultRoomId(),
                        cg.getClassTeacherStaffId(),
                        cg.isHomeroomLocked(),
                        cg.getHomeroomSource(),
                        cg.getClassTeacherSource(),
                        cg.isClassTeacherLocked()))
                .toList();

        List<OnboardingAcademicAllocationItemDTO> aRows = subjectAllocationRepo.findBySchool_Id(schoolId).stream()
                .map(
                        a -> new OnboardingAcademicAllocationItemDTO(
                                a.getId(),
                                a.getClassGroup().getId(),
                                activeSubjectIdByCode.getOrDefault(
                                        (a.getSubject() != null && a.getSubject().getCode() != null)
                                                ? a.getSubject().getCode().trim().toUpperCase(java.util.Locale.ROOT)
                                                : "",
                                        a.getSubject().getId()),
                                a.getStaff() == null ? null : a.getStaff().getId(),
                                a.getWeeklyFrequency(),
                                a.getRoom() == null ? null : a.getRoom().getId()))
                .toList();

        List<OnboardingClassSubjectConfigDTO> classCfg = classSubjectConfigRepo.findBySchool_Id(schoolId).stream()
                .map(c -> new OnboardingClassSubjectConfigDTO(
                        c.getGradeLevel(),
                        activeSubjectIdByCode.getOrDefault(
                                (c.getSubject() != null && c.getSubject().getCode() != null)
                                        ? c.getSubject().getCode().trim().toUpperCase(java.util.Locale.ROOT)
                                        : "",
                                c.getSubject().getId()),
                        c.getDefaultPeriodsPerWeek(),
                        c.getStaff() == null ? null : c.getStaff().getId(),
                        c.getRoom() == null ? null : c.getRoom().getId()
                ))
                .toList();

        List<OnboardingSectionSubjectOverrideDTO> secOv = subjectSectionOverrideRepo.findBySubject_School_Id(schoolId).stream()
                .map(o -> new OnboardingSectionSubjectOverrideDTO(
                        o.getClassGroup().getId(),
                        activeSubjectIdByCode.getOrDefault(
                                (o.getSubject() != null && o.getSubject().getCode() != null)
                                        ? o.getSubject().getCode().trim().toUpperCase(java.util.Locale.ROOT)
                                        : "",
                                o.getSubject().getId()),
                        o.getPeriodsPerWeek(),
                        o.getStaff() == null ? null : o.getStaff().getId(),
                        o.getRoom() == null ? null : o.getRoom().getId()
                ))
                .toList();

        // Normalize slot meta subjectIds too, so lock/source follows the active subject row.
        List<OnboardingAcademicSlotMetaDTO> slotMetaNorm = slotMeta.stream()
                .map(m -> {
                    String code = anySubjectCodeById.get(m.subjectId());
                    if (code == null || code.isBlank()) return null;
                    Integer activeId = activeSubjectIdByCode.get(code);
                    if (activeId == null) return null;
                    return new OnboardingAcademicSlotMetaDTO(
                            m.classGroupId(),
                            activeId,
                            m.source(),
                            m.locked(),
                            m.roomSource(),
                            m.roomLocked());
                })
                .filter(java.util.Objects::nonNull)
                .toList();

        return new OnboardingAcademicStructureViewDTO(sRows, stRows, cgRows, aRows, classCfg, secOv, slotMetaNorm);
    }

    @Transactional
    public void saveAcademicStructure(OnboardingAcademicStructureSaveDTO body) {
        if (body == null) throw new IllegalArgumentException("body is required");
        Integer schoolId = requireSchoolId();
        School school = schoolRepo.findById(schoolId).orElseThrow();
        // Allow saving even when users deep-link from the dashboard or revisit later.
        // We only advance the wizard when the tenant is still in the setup flow.
        OnboardingStatus current = school.getOnboardingStatus();

        boolean hasNewCfg = (body.classSubjectConfigs() != null && !body.classSubjectConfigs().isEmpty())
                || (body.sectionSubjectOverrides() != null && !body.sectionSubjectOverrides().isEmpty());

        if (hasNewCfg) {
            // Replace templates + overrides
            classSubjectConfigRepo.deleteBySchool_Id(schoolId);
            subjectSectionOverrideRepo.deleteBySubjectSchool_Id(schoolId);

            if (body.classSubjectConfigs() != null) {
                for (OnboardingClassSubjectConfigDTO row : body.classSubjectConfigs()) {
                    if (row == null) continue;
                    if (row.gradeLevel() == null || row.gradeLevel() < 1 || row.gradeLevel() > 12) {
                        throw new IllegalArgumentException("gradeLevel must be 1..12");
                    }
                    if (row.defaultPeriodsPerWeek() == null || row.defaultPeriodsPerWeek() <= 0) {
                        throw new IllegalArgumentException("defaultPeriodsPerWeek must be positive for grade " + row.gradeLevel());
                    }
                    Subject sub = subjectRepo.findById(row.subjectId())
                            .filter(s -> schoolId.equals(s.getSchool().getId()))
                            .orElseThrow(() -> new IllegalArgumentException("Unknown subject id for this school: " + row.subjectId()));
                    Staff stf = row.defaultTeacherId() == null ? null :
                            staffRepo.findByIdAndSchool_Id(row.defaultTeacherId(), schoolId).orElseThrow();
                    Room rm = row.defaultRoomId() == null ? null :
                            roomRepo.findByIdAndSchool_Id(row.defaultRoomId(), schoolId).orElseThrow();

                    ClassSubjectConfig c = new ClassSubjectConfig();
                    c.setSchool(school);
                    c.setGradeLevel(row.gradeLevel());
                    c.setSubject(sub);
                    c.setDefaultPeriodsPerWeek(row.defaultPeriodsPerWeek());
                    c.setStaff(stf);
                    c.setRoom(rm);
                    classSubjectConfigRepo.save(c);
                }
            }

            if (body.sectionSubjectOverrides() != null) {
                for (OnboardingSectionSubjectOverrideDTO row : body.sectionSubjectOverrides()) {
                    if (row == null) continue;
                    if (row.periodsPerWeek() == null && row.teacherId() == null) continue;
                    // periodsPerWeek = 0 is allowed and means "disabled for this section" (used by Step 6 mapping UX).
                    if (row.periodsPerWeek() != null && row.periodsPerWeek() < 0) {
                        throw new IllegalArgumentException("periodsPerWeek must be >= 0 when provided");
                    }
                    ClassGroup cg = classGroupRepo.findByIdAndSchool_Id(row.classGroupId(), schoolId).orElseThrow();
                    Subject sub = subjectRepo.findById(row.subjectId())
                            .filter(s -> schoolId.equals(s.getSchool().getId()))
                            .orElseThrow(() -> new IllegalArgumentException("Unknown subject id for this school: " + row.subjectId()));
                    Staff stf = row.teacherId() == null ? null :
                            staffRepo.findByIdAndSchool_Id(row.teacherId(), schoolId).orElseThrow();
                    SubjectSectionOverride o = new SubjectSectionOverride();
                    o.setClassGroup(cg);
                    o.setSubject(sub);
                    o.setPeriodsPerWeek(row.periodsPerWeek());
                    o.setStaff(stf);
                    o.setRoom(null);
                    subjectSectionOverrideRepo.save(o);
                }
            }

            rebuildAllocationsFromTemplates(school, schoolId);
        } else {
            if (body.allocations() == null || body.allocations().isEmpty()) {
                throw new IllegalArgumentException("Add at least one class subject allocation.");
            }
            saveAllocationsDirect(school, schoolId, body.allocations());
        }

        if (body.defaultRooms() != null) {
            for (OnboardingClassDefaultRoomItemDTO it : body.defaultRooms()) {
                if (it == null) continue;
                ClassGroup cg = classGroupRepo.findByIdAndSchool_Id(it.classGroupId(), schoolId).orElseThrow();
                if (it.roomId() == null) {
                    cg.setDefaultRoom(null);
                    cg.setHomeroomLocked(false);
                    cg.setHomeroomSource(null);
                } else {
                    Room r = roomRepo.findByIdAndSchool_Id(it.roomId(), schoolId).orElseThrow();
                    cg.setDefaultRoom(r);
                    if (it.homeroomLocked() != null) {
                        cg.setHomeroomLocked(it.homeroomLocked());
                    }
                    if (it.homeroomSource() != null) {
                        cg.setHomeroomSource(normalizeAssignmentSource(it.homeroomSource()));
                    }
                }
                classGroupRepo.save(cg);
            }
        }

        if (body.classTeachers() != null) {
            for (OnboardingClassTeacherItemDTO it : body.classTeachers()) {
                if (it == null) continue;
                ClassGroup cg = classGroupRepo.findByIdAndSchool_Id(it.classGroupId(), schoolId).orElseThrow();
                if (it.staffId() == null) {
                    cg.setClassTeacher(null);
                    cg.setClassTeacherSource(null);
                    cg.setClassTeacherLocked(false);
                } else {
                    Staff st = staffRepo.findByIdAndSchool_Id(it.staffId(), schoolId).orElseThrow();
                    cg.setClassTeacher(st);
                    if (it.classTeacherLocked() != null) {
                        cg.setClassTeacherLocked(it.classTeacherLocked());
                    }
                    if (it.classTeacherSource() != null) {
                        cg.setClassTeacherSource(normalizeAssignmentSource(it.classTeacherSource()));
                    }
                }
                classGroupRepo.save(cg);
            }
        }

        // Single source of truth: legacy mapping tables cleared; class-group rows derived from allocations.
        subjectClassMappingRepo.deleteBySubjectSchool_Id(schoolId);
        subjectClassGroupRepo.deleteBySubjectSchool_Id(schoolId);
        materializeSubjectClassGroupsFromAllocations(schoolId);

        markCompleted(school, OnboardingStatus.ACADEMIC_STRUCTURE);
        // Advance only if we're still before (or at) the timetable step.
        if (current == OnboardingStatus.ACADEMIC_STRUCTURE) {
            school.setOnboardingStatus(OnboardingStatus.TIMETABLE);
        } else if (current == OnboardingStatus.TIMETABLE) {
            school.setOnboardingStatus(OnboardingStatus.TIMETABLE);
        } else if (java.util.EnumSet.of(
                OnboardingStatus.BASIC_INFO,
                OnboardingStatus.CLASSES,
                OnboardingStatus.SUBJECTS,
                OnboardingStatus.ROOMS,
                OnboardingStatus.SUBJECT_CLASS_MAPPING, // legacy
                OnboardingStatus.CLASS_DEFAULT_ROOMS,    // legacy
                OnboardingStatus.ROLES,                  // legacy
                OnboardingStatus.STAFF
        ).contains(current)) {
            school.setOnboardingStatus(OnboardingStatus.TIMETABLE);
        }
        if (body.assignmentSlotMeta() != null) {
            if (body.assignmentSlotMeta().isEmpty()) {
                school.setOnboardingAcademicAssignmentMetaJson(null);
            } else {
                try {
                    school.setOnboardingAcademicAssignmentMetaJson(
                            objectMapper.writeValueAsString(body.assignmentSlotMeta()));
                } catch (Exception e) {
                    throw new IllegalArgumentException("Invalid assignment slot meta", e);
                }
            }
        }
        schoolRepo.save(school);
    }

    private List<String> buildTeacherDemandWarnings() {
        try {
            TeacherDemandSummaryDTO d = teacherDemandAnalysisService.summarize();
            if (d == null || !d.hasSevereShortage()) {
                return List.of();
            }
            List<String> w = new ArrayList<>();
            w.add(
                    "Teacher capacity may be insufficient for one or more subjects. Review demand vs capacity before relying on auto-fill.");
            int n = 0;
            for (TeacherDemandSubjectRowDTO r : d.subjects()) {
                if (r == null) continue;
                if (!"CRITICAL".equals(r.status()) || r.requiredPeriods() <= 0) continue;
                w.add(r.subjectName() + " (" + r.subjectCode() + "): " + r.statusDetail());
                n++;
                if (n >= 12) break;
            }
            return w;
        } catch (Exception ignored) {
            return List.of();
        }
    }

    @Transactional
    public OnboardingTimetableAutoGenerateViewDTO autoGenerateTimetableDraft() {
        Integer schoolId = requireSchoolId();
        TimetableVersionViewDTO ver = timetableGridV2Service.ensureDraftVersion();
        java.util.List<ClassGroup> classGroups = classGroupRepo.findAllBySchool_IdAndIsDeletedFalseOrderByGradeLevelAscCodeAsc(schoolId);
        java.util.List<OnboardingTimetableClassAutoFillItemDTO> out = new java.util.ArrayList<>();
        int totalPlaced = 0;
        int totalRequired = 0;
        for (ClassGroup cg : classGroups) {
            java.util.List<SubjectAllocation> allocs =
                    subjectAllocationRepo.findBySchool_IdAndClassGroup_Id(schoolId, cg.getId());
            for (SubjectAllocation a : allocs) {
                int f = a.getWeeklyFrequency() == null ? 0 : a.getWeeklyFrequency();
                totalRequired += Math.max(0, f);
            }
            AutoFillResultDTO r;
            try {
                r = timetableGridV2Service.autoFill(
                        new AutoFillRequestDTO(ver.id(), cg.getId(), "REPLACE"));
            } catch (Exception e) {
                String msg = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
                r = new AutoFillResultDTO(0, 0, 0, 0, java.util.List.of("Auto-fill failed: " + msg));
            }
            totalPlaced += r.placedCount();
            out.add(new OnboardingTimetableClassAutoFillItemDTO(cg.getId(), cg.getCode(), r));
        }
        List<String> demandWarnings = buildTeacherDemandWarnings();
        return new OnboardingTimetableAutoGenerateViewDTO(
                ver.id(), ver.status(), ver.version(), out, demandWarnings, totalPlaced, totalRequired);
    }

    @Transactional
    public void completeTimetableOnboarding() {
        Integer schoolId = requireSchoolId();
        School school = schoolRepo.findById(schoolId).orElseThrow();
        if (school.getOnboardingStatus() != OnboardingStatus.TIMETABLE) {
            throw new IllegalStateException("Timetable step is not current.");
        }
        markCompleted(school, OnboardingStatus.TIMETABLE);
        school.setOnboardingStatus(OnboardingStatus.STUDENTS);
        schoolRepo.save(school);
    }

    private void materializeSubjectClassGroupsFromAllocations(Integer schoolId) {
        for (SubjectAllocation a : subjectAllocationRepo.findBySchool_Id(schoolId)) {
            SubjectClassGroup scg = new SubjectClassGroup();
            scg.setSubject(a.getSubject());
            scg.setClassGroup(a.getClassGroup());
            subjectClassGroupRepo.save(scg);
        }
    }

    private void saveAllocationsDirect(School school, Integer schoolId, List<OnboardingAcademicAllocationInputDTO> allocations) {
        java.util.Set<String> uniqueAlloc = new java.util.HashSet<>();
        for (OnboardingAcademicAllocationInputDTO row : allocations) {
            if (row == null) continue;
            if (row.classGroupId() == null || row.subjectId() == null) {
                throw new IllegalArgumentException("classGroupId and subjectId are required");
            }
            String u = row.classGroupId() + ":" + row.subjectId();
            if (uniqueAlloc.contains(u)) {
                throw new IllegalArgumentException("Duplicate subject for class: classGroupId=" + row.classGroupId() + " subjectId=" + row.subjectId());
            }
            uniqueAlloc.add(u);
            if (row.weeklyFrequency() == null || row.weeklyFrequency() <= 0) {
                throw new IllegalArgumentException("weeklyFrequency must be positive for class " + row.classGroupId());
            }
        }

        subjectAllocationRepo.deleteBySchool_Id(schoolId);

        for (OnboardingAcademicAllocationInputDTO row : allocations) {
            if (row == null) continue;
            ClassGroup cg = classGroupRepo.findByIdAndSchool_Id(row.classGroupId(), schoolId).orElseThrow();
            Subject sub = subjectRepo.findById(row.subjectId())
                    .filter(s -> schoolId.equals(s.getSchool().getId()))
                    .orElseThrow(() -> new IllegalArgumentException("Unknown subject id for this school: " + row.subjectId()));
            Staff stf = row.staffId() == null ? null : staffRepo.findByIdAndSchool_Id(row.staffId(), schoolId).orElseThrow();

            if (stf != null) {
                java.util.Set<Integer> teach = new java.util.HashSet<>(
                        staffTeachableSubjectRepository.findByStaff_Id(stf.getId()).stream()
                                .map(t -> t.getSubject().getId())
                                .toList());
                if (!teach.isEmpty() && !teach.contains(sub.getId())) {
                    throw new IllegalArgumentException(
                            "Staff " + stf.getFullName() + " is not allowed to teach " + sub.getCode() + " (not in their teachable subjects).");
                }
            }

            SubjectAllocation a = new SubjectAllocation();
            a.setSchool(school);
            a.setClassGroup(cg);
            a.setSubject(sub);
            a.setStaff(stf);
            a.setWeeklyFrequency(row.weeklyFrequency());
            a.setRoom(cg.getDefaultRoom());
            subjectAllocationRepo.save(a);
        }
    }

    private void rebuildAllocationsFromTemplates(School school, Integer schoolId) {
        subjectAllocationRepo.deleteBySchool_Id(schoolId);

        List<ClassSubjectConfig> classCfg = classSubjectConfigRepo.findBySchool_Id(schoolId);
        Map<Integer, List<ClassSubjectConfig>> cfgByGrade = new HashMap<>();
        for (ClassSubjectConfig c : classCfg) {
            if (c.getGradeLevel() == null) continue;
            cfgByGrade.computeIfAbsent(c.getGradeLevel(), k -> new ArrayList<>()).add(c);
        }

        Map<String, SubjectSectionOverride> overrideByKey = new HashMap<>();
        for (SubjectSectionOverride o : subjectSectionOverrideRepo.findBySubject_School_Id(schoolId)) {
            if (o.getClassGroup() == null || o.getSubject() == null) continue;
            overrideByKey.put(o.getClassGroup().getId() + ":" + o.getSubject().getId(), o);
        }

        for (ClassGroup cg : classGroupRepo.findAllBySchool_IdAndIsDeletedFalseOrderByGradeLevelAscCodeAsc(schoolId)) {
            Integer grade = cg.getGradeLevel();
            if (grade == null) continue;
            List<ClassSubjectConfig> rows = cfgByGrade.getOrDefault(grade, List.of());
            for (ClassSubjectConfig c : rows) {
                SubjectSectionOverride o = overrideByKey.get(cg.getId() + ":" + c.getSubject().getId());
                Integer weekly = o != null && o.getPeriodsPerWeek() != null ? o.getPeriodsPerWeek() : c.getDefaultPeriodsPerWeek();
                if (weekly == null || weekly <= 0) continue;
                Staff staff = o != null && o.getStaff() != null ? o.getStaff() : c.getStaff();
                Room room = cg.getDefaultRoom();

                SubjectAllocation a = new SubjectAllocation();
                a.setSchool(school);
                a.setClassGroup(cg);
                a.setSubject(c.getSubject());
                a.setStaff(staff);
                a.setRoom(room);
                a.setWeeklyFrequency(weekly);
                subjectAllocationRepo.save(a);
            }
        }
    }

    private void replaceTeachableForStaff(Staff staff, List<Integer> subjectIds, Integer schoolId) {
        staffTeachableSubjectRepository.deleteByStaff_Id(staff.getId());
        if (subjectIds == null || subjectIds.isEmpty()) {
            return;
        }
        // Normalize incoming subjectIds by code → active (non-deleted) subject row.
        // This prevents stale teachables when subjects were deleted/re-created.
        java.util.Map<String, Integer> activeByCode = new java.util.HashMap<>();
        for (Subject s : subjectRepo.findBySchool_IdAndIsDeletedFalseOrderByCodeAsc(schoolId)) {
            if (s.getCode() == null) continue;
            String c = s.getCode().trim().toUpperCase(java.util.Locale.ROOT);
            if (!c.isBlank()) activeByCode.put(c, s.getId());
        }
        for (Integer sid : new LinkedHashSet<>(subjectIds)) {
            if (sid == null) continue;
            Subject sub = subjectRepo.findById(sid).filter(s -> schoolId.equals(s.getSchool().getId())).orElseThrow(
                    () -> new IllegalArgumentException("Unknown subject id for this school: " + sid));
            String rawCode = sub.getCode() == null ? "" : sub.getCode().trim().toUpperCase(java.util.Locale.ROOT);
            Integer activeId = rawCode.isBlank() ? null : activeByCode.get(rawCode);
            if (activeId != null && !activeId.equals(sub.getId())) {
                sub = subjectRepo.findById(activeId).orElse(sub);
            }
            StaffTeachableSubject st = new StaffTeachableSubject();
            st.setStaff(staff);
            st.setSubject(sub);
            staffTeachableSubjectRepository.save(st);
        }
    }

    private String deriveUsername(String email) {
        int at = email.indexOf('@');
        String base = at > 0 ? email.substring(0, at) : email;
        base = base.replaceAll("[^a-zA-Z0-9._-]", "");
        if (base.isBlank()) base = "user";
        return base;
    }

    private String ensureUniqueUsername(String base) {
        String u = base;
        int i = 1;
        while (userRepo.findFirstByUsernameIgnoreCase(u).isPresent()) {
            i += 1;
            u = base + i;
        }
        return u;
    }

    private String generateTempPassword() {
        // Simple temp password (demo-safe); real system should send magic link or force reset.
        String chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 10; i++) {
            int idx = (int) (Math.random() * chars.length());
            sb.append(chars.charAt(idx));
        }
        return "MH-" + sb;
    }

    @Transactional(readOnly = true)
    public OnboardingBasicInfoDTO basicInfo() {
        School s = schoolRepo.findById(requireSchoolId()).orElseThrow();
        if (s.getOnboardingBasicInfoJson() == null || s.getOnboardingBasicInfoJson().isBlank()) {
            return null;
        }
        try {
            // Backwards compatible: older payload stored `timeSlots` (e.g. ["09:00-17:00"]).
            String raw = s.getOnboardingBasicInfoJson();
            try {
                OnboardingBasicInfoDTO dto = objectMapper.readValue(raw, OnboardingBasicInfoDTO.class);
                if (dto.attendanceMode() == null) {
                    return new OnboardingBasicInfoDTO(
                            dto.academicYear(),
                            dto.startMonth(),
                            dto.workingDays(),
                            s.getAttendanceMode(),
                            dto.openWindows(),
                            dto.schoolStartTime(),
                            dto.schoolEndTime(),
                            dto.lectureDurationMinutes()
                    );
                }
                return dto;
            } catch (Exception ignored) {
                com.fasterxml.jackson.databind.JsonNode node = objectMapper.readTree(raw);
                if (node == null || !node.isObject()) throw new IllegalStateException("Could not read onboarding basic info");

                String academicYear = node.path("academicYear").asText("");
                Integer startMonth = node.path("startMonth").isNumber() ? node.path("startMonth").asInt() : null;
                java.util.List<String> workingDays = new java.util.ArrayList<>();
                com.fasterxml.jackson.databind.JsonNode wd = node.path("workingDays");
                if (wd != null && wd.isArray()) {
                    for (com.fasterxml.jackson.databind.JsonNode it : wd) {
                        if (it == null) continue;
                        String v = it.asText("").trim();
                        if (!v.isBlank()) workingDays.add(v);
                    }
                }

                String schoolStartTime = node.path("schoolStartTime").asText("");
                String schoolEndTime = node.path("schoolEndTime").asText("");
                Integer lectureDurationMinutes =
                        node.path("lectureDurationMinutes").isNumber() ? node.path("lectureDurationMinutes").asInt() : null;

                // legacy fallback: timeSlots like "09:00-17:00"
                if ((schoolStartTime.isBlank() || schoolEndTime.isBlank()) && node.has("timeSlots")) {
                    com.fasterxml.jackson.databind.JsonNode ts = node.path("timeSlots");
                    if (ts != null && ts.isArray() && ts.size() > 0) {
                        String first = ts.get(0).asText("");
                        java.util.regex.Matcher m = java.util.regex.Pattern
                                .compile("^(\\d{1,2}:\\d{2})\\s*-\\s*(\\d{1,2}:\\d{2})$")
                                .matcher(first.trim());
                        if (m.find()) {
                            schoolStartTime = m.group(1).trim();
                            schoolEndTime = m.group(2).trim();
                        }
                    }
                }
                if (lectureDurationMinutes == null || lectureDurationMinutes < 10) lectureDurationMinutes = 45;

                return new OnboardingBasicInfoDTO(
                        academicYear,
                        startMonth,
                        workingDays,
                        s.getAttendanceMode(),
                        null,
                        schoolStartTime,
                        schoolEndTime,
                        lectureDurationMinutes
                );
            }
        } catch (Exception e) {
            throw new IllegalStateException("Could not read onboarding basic info");
        }
    }

    /** Normalizes client payloads to lowercase {@code auto} / {@code manual}; blank becomes null. */
    private static String normalizeAssignmentSource(String raw) {
        if (raw == null) {
            return null;
        }
        String s = raw.trim().toLowerCase(java.util.Locale.ROOT);
        if (s.isEmpty()) {
            return null;
        }
        if ("auto".equals(s)) {
            return "auto";
        }
        if ("manual".equals(s)) {
            return "manual";
        }
        throw new IllegalArgumentException("Assignment source must be 'auto' or 'manual'");
    }

    private void markCompleted(School s, OnboardingStatus step) {
        List<String> completed = parseCompleted(s.getOnboardingCompletedJson());
        Set<String> set = new LinkedHashSet<>(completed);
        set.add(step.name());
        try {
            // simplest: store JSON array of strings
            s.setOnboardingCompletedJson(objectMapper.writeValueAsString(new ArrayList<>(set)));
        } catch (Exception e) {
            // fallback to null-safe minimal
            s.setOnboardingCompletedJson("[\"" + step.name() + "\"]");
        }
    }

    private List<String> parseCompleted(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json, STR_LIST);
        } catch (Exception e) {
            return List.of();
        }
    }
}

