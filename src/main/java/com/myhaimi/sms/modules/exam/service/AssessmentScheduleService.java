package com.myhaimi.sms.modules.exam.service;

import com.myhaimi.sms.entity.AcademicYear;
import com.myhaimi.sms.entity.ClassGroup;
import com.myhaimi.sms.entity.Room;
import com.myhaimi.sms.entity.School;
import com.myhaimi.sms.entity.Subject;
import com.myhaimi.sms.modules.exam.dto.AssessmentGenerateRequestDTO;
import com.myhaimi.sms.modules.exam.dto.AssessmentInstanceCreateDTO;
import com.myhaimi.sms.modules.exam.dto.AssessmentInstanceDTO;
import com.myhaimi.sms.modules.exam.dto.AssessmentInstanceUpdateDTO;
import com.myhaimi.sms.modules.exam.dto.BulkPublishRequestDTO;
import com.myhaimi.sms.modules.exam.dto.BulkSaveDraftsRequestDTO;
import com.myhaimi.sms.modules.exam.dto.ExamScheduleGenerateRequestDTO;
import com.myhaimi.sms.modules.exam.dto.ExamScheduleGenerateResponseDTO;
import com.myhaimi.sms.modules.exam.dto.ScheduleCandidateDTO;
import com.myhaimi.sms.modules.exam.dto.ScheduleGenerateCandidatesRequestDTO;
import com.myhaimi.sms.modules.exam.entity.AssessmentComponent;
import com.myhaimi.sms.modules.exam.entity.AssessmentInstance;
import com.myhaimi.sms.modules.exam.entity.AssessmentScheme;
import com.myhaimi.sms.modules.exam.entity.AssessmentSchemeAssignment;
import com.myhaimi.sms.modules.exam.entity.enums.AssessmentInstanceStatus;
import com.myhaimi.sms.modules.exam.entity.enums.AssessmentSchemeStatus;
import com.myhaimi.sms.modules.exam.entity.enums.CalculationRule;
import com.myhaimi.sms.modules.exam.entity.enums.ComponentType;
import com.myhaimi.sms.modules.exam.entity.enums.ExamApplicableScopeType;
import com.myhaimi.sms.modules.exam.entity.enums.SchedulingMode;
import com.myhaimi.sms.modules.exam.repository.AssessmentComponentRepository;
import com.myhaimi.sms.modules.exam.repository.AssessmentInstanceRepository;
import com.myhaimi.sms.modules.exam.repository.AssessmentSchemeAssignmentRepository;
import com.myhaimi.sms.modules.exam.repository.AssessmentSchemeRepository;
import com.myhaimi.sms.repository.AcademicYearRepo;
import com.myhaimi.sms.repository.ClassGroupRepo;
import com.myhaimi.sms.repository.RoomRepo;
import com.myhaimi.sms.repository.SchoolRepo;
import com.myhaimi.sms.repository.SubjectClassGroupRepo;
import com.myhaimi.sms.repository.SubjectRepo;
import com.myhaimi.sms.repository.TimetableEntryRepo;
import com.myhaimi.sms.repository.TimetableVersionRepo;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AssessmentScheduleService {

    private final AssessmentInstanceRepository instanceRepo;
    private final AssessmentSchemeRepository schemeRepo;
    private final AssessmentComponentRepository componentRepo;
    private final AssessmentSchemeAssignmentRepository assignmentRepo;
    private final SchoolRepo schoolRepo;
    private final SubjectRepo subjectRepo;
    private final ClassGroupRepo classGroupRepo;
    private final RoomRepo roomRepo;
    private final AcademicYearRepo academicYearRepo;
    private final SubjectClassGroupRepo subjectClassGroupRepo;
    private final TimetableVersionRepo timetableVersionRepo;
    private final TimetableEntryRepo timetableEntryRepo;

    @Transactional
    public AssessmentInstanceDTO createAssessment(AssessmentInstanceCreateDTO dto) {
        Integer schoolId = requireSchoolId();
        AssessmentScheme scheme = requirePublishedScheme(dto.schemeId(), schoolId);
        AssessmentComponent component = requireComponentOfScheme(dto.componentId(), scheme.getId());
        validateComponentAllowsInstance(component);
        validateDuplicateName(null, schoolId, component.getId(), dto.classGroupId(), dto.subjectId(), dto.name());
        validateAssessmentCountLimit(schoolId, component, dto.classGroupId(), dto.subjectId(), null);

        AssessmentInstance instance = new AssessmentInstance();
        instance.setSchool(requireSchool(schoolId));
        instance.setAcademicYear(scheme.getAcademicYear());
        instance.setScheme(scheme);
        instance.setComponent(component);
        applyCreatePayload(instance, dto, schoolId);
        instance.setStatus(AssessmentInstanceStatus.DRAFT);

        return toDTO(instanceRepo.save(instance));
    }

    @Transactional
    public AssessmentInstanceDTO updateAssessment(Integer assessmentId, AssessmentInstanceUpdateDTO dto) {
        Integer schoolId = requireSchoolId();
        AssessmentInstance instance = requireInstance(assessmentId, schoolId);
        ensureEditable(instance);

        validateDuplicateName(instance.getId(), schoolId, instance.getComponent().getId(), dto.classGroupId(), dto.subjectId(), dto.name());
        validateAssessmentCountLimit(schoolId, instance.getComponent(), dto.classGroupId(), dto.subjectId(), instance.getId());
        applyUpdatePayload(instance, dto, schoolId);

        return toDTO(instanceRepo.save(instance));
    }

    public List<AssessmentInstanceDTO> listAssessments(
            Integer academicYearId,
            Integer classGroupId,
            Integer subjectId,
            Integer schemeId,
            Integer componentId
    ) {
        Integer schoolId = requireSchoolId();
        return instanceRepo.listForFilters(schoolId, academicYearId, classGroupId, subjectId, schemeId, componentId)
                .stream()
                .map(this::toDTO)
                .toList();
    }

    public AssessmentInstanceDTO getAssessment(Integer assessmentId) {
        return toDTO(requireInstance(assessmentId, requireSchoolId()));
    }

    @Transactional
    public AssessmentInstanceDTO cancelAssessment(Integer assessmentId) {
        AssessmentInstance instance = requireInstance(assessmentId, requireSchoolId());
        if (instance.getStatus() == AssessmentInstanceStatus.CANCELLED) {
            throw new IllegalStateException("Assessment is already cancelled");
        }
        instance.setStatus(AssessmentInstanceStatus.CANCELLED);
        return toDTO(instanceRepo.save(instance));
    }

    @Transactional
    public AssessmentInstanceDTO openMarksEntry(Integer assessmentId) {
        AssessmentInstance instance = requireInstance(assessmentId, requireSchoolId());
        if (instance.getStatus() == AssessmentInstanceStatus.LOCKED
                || instance.getStatus() == AssessmentInstanceStatus.PUBLISHED
                || instance.getStatus() == AssessmentInstanceStatus.CANCELLED) {
            throw new IllegalStateException("Marks entry cannot be opened for status " + instance.getStatus());
        }
        instance.setStatus(AssessmentInstanceStatus.MARKS_ENTRY_OPEN);
        return toDTO(instanceRepo.save(instance));
    }

    @Transactional
    public AssessmentInstanceDTO lockAssessment(Integer assessmentId) {
        AssessmentInstance instance = requireInstance(assessmentId, requireSchoolId());
        if (instance.getStatus() == AssessmentInstanceStatus.CANCELLED) {
            throw new IllegalStateException("Cancelled assessment cannot be locked");
        }
        instance.setStatus(AssessmentInstanceStatus.LOCKED);
        return toDTO(instanceRepo.save(instance));
    }

    @Transactional
    public AssessmentInstanceDTO publishAssessment(Integer assessmentId) {
        AssessmentInstance instance = requireInstance(assessmentId, requireSchoolId());
        if (instance.getStatus() != AssessmentInstanceStatus.DRAFT) {
            throw new IllegalStateException("Only DRAFT assessments can be published/scheduled");
        }
        if (instance.getAssessmentDate() == null) {
            throw new IllegalStateException("Assessment date is required before publishing");
        }
        if (instance.getStartTime() == null || instance.getEndTime() == null) {
            throw new IllegalStateException("Start time and end time are required before publishing");
        }
        if (instance.getMaxMarks() == null || instance.getMaxMarks().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalStateException("Max marks must be greater than 0 before publishing");
        }
        instance.setStatus(AssessmentInstanceStatus.SCHEDULED);
        return toDTO(instanceRepo.save(instance));
    }

    @Transactional
    public AssessmentInstanceDTO cloneAssessment(Integer assessmentId) {
        Integer schoolId = requireSchoolId();
        AssessmentInstance source = requireInstance(assessmentId, schoolId);
        AssessmentInstance clone = new AssessmentInstance();
        clone.setSchool(source.getSchool());
        clone.setAcademicYear(source.getAcademicYear());
        clone.setScheme(source.getScheme());
        clone.setComponent(source.getComponent());
        clone.setName(source.getName() + " (Copy)");
        clone.setSubject(source.getSubject());
        clone.setClassGroup(source.getClassGroup());
        clone.setAssessmentDate(null);
        clone.setStartTime(source.getStartTime());
        clone.setEndTime(source.getEndTime());
        clone.setRoom(source.getRoom());
        clone.setMaxMarks(source.getMaxMarks());
        clone.setSequence(source.getSequence());
        clone.setStatus(AssessmentInstanceStatus.DRAFT);
        return toDTO(instanceRepo.save(clone));
    }

    @Transactional
    public void deleteAssessment(Integer assessmentId) {
        Integer schoolId = requireSchoolId();
        AssessmentInstance instance = requireInstance(assessmentId, schoolId);
        if (instance.getStatus() != AssessmentInstanceStatus.DRAFT
                && instance.getStatus() != AssessmentInstanceStatus.CANCELLED) {
            throw new IllegalStateException("Only DRAFT or CANCELLED assessments can be deleted");
        }
        instanceRepo.delete(instance);
    }

    @Transactional
    public List<AssessmentInstanceDTO> generateAssessmentsForClassScheme(Integer schemeId, AssessmentGenerateRequestDTO dto) {
        Integer schoolId = requireSchoolId();
        AssessmentScheme scheme = requirePublishedScheme(schemeId, schoolId);

        List<Integer> classGroupIds = dto.classGroupIds() == null ? List.of()
                : dto.classGroupIds().stream().filter(Objects::nonNull).distinct().toList();
        List<Integer> subjectIds = dto.subjectIds() == null ? List.of()
                : dto.subjectIds().stream().filter(Objects::nonNull).distinct().toList();

        if (classGroupIds.isEmpty() || subjectIds.isEmpty()) {
            List<AssessmentSchemeAssignment> assignments = assignmentRepo.findActiveForGeneration(
                    schoolId, scheme.getAcademicYear().getId(), scheme.getId());
            if (classGroupIds.isEmpty()) {
                classGroupIds = assignments.stream()
                        .map(AssessmentSchemeAssignment::getClassGroup)
                        .filter(Objects::nonNull)
                        .map(ClassGroup::getId)
                        .distinct()
                        .toList();
                if (classGroupIds.isEmpty()) {
                    classGroupIds = classGroupRepo.findAllBySchool_IdAndIsDeletedFalseOrderByGradeLevelAscCodeAsc(schoolId)
                            .stream().map(ClassGroup::getId).toList();
                }
            }
            if (subjectIds.isEmpty()) {
                subjectIds = assignments.stream()
                        .map(AssessmentSchemeAssignment::getSubject)
                        .filter(Objects::nonNull)
                        .map(Subject::getId)
                        .distinct()
                        .toList();
                if (subjectIds.isEmpty()) {
                    subjectIds = subjectRepo.findBySchool_IdAndIsDeletedFalseOrderByCodeAsc(schoolId)
                            .stream().map(Subject::getId).toList();
                }
            }
        }
        if (classGroupIds.isEmpty() || subjectIds.isEmpty()) {
            throw new IllegalArgumentException("No class/subject targets found. Assign the scheme or provide classGroupIds and subjectIds.");
        }

        Map<Integer, ClassGroup> classGroupById = new HashMap<>();
        for (Integer classGroupId : classGroupIds) {
            classGroupById.put(classGroupId, requireClassGroup(classGroupId, schoolId));
        }

        Map<Integer, Subject> subjectById = new HashMap<>();
        for (Integer subjectId : subjectIds) {
            subjectById.put(subjectId, requireSubject(subjectId, schoolId));
        }

        Map<String, LocalDate> dateOverrides = new HashMap<>();
        if (dto.assessmentDates() != null) {
            for (AssessmentGenerateRequestDTO.AssessmentDateOverrideDTO d : dto.assessmentDates()) {
                if (d == null || d.componentId() == null || d.classGroupId() == null || d.subjectId() == null || d.sequence() == null) {
                    continue;
                }
                String key = keyFor(d.componentId(), d.classGroupId(), d.subjectId(), d.sequence());
                dateOverrides.put(key, d.assessmentDate());
            }
        }

        List<AssessmentComponent> components = scheme.getComponents().stream()
                .filter(c -> c.getCalculationRule() != CalculationRule.ATTENDANCE_PERCENTAGE)
                .sorted(Comparator.comparing(AssessmentComponent::getSequence))
                .toList();

        List<AssessmentInstance> created = new ArrayList<>();
        for (AssessmentComponent component : components) {
            int totalToGenerate = resolveInstancesToGenerate(component);
            BigDecimal maxMarks = component.getMaxMarks();
            if (maxMarks == null || maxMarks.compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalStateException("Component '" + component.getName() + "' must have max marks to generate assessments");
            }

            for (Integer classGroupId : classGroupIds) {
                for (Integer subjectId : subjectIds) {
                    long existing = instanceRepo.countBySchool_IdAndComponent_IdAndClassGroup_IdAndSubject_IdAndStatusNot(
                            schoolId,
                            component.getId(),
                            classGroupId,
                            subjectId,
                            AssessmentInstanceStatus.CANCELLED
                    );
                    int missing = Math.max(totalToGenerate - (int) existing, 0);
                    for (int i = 1; i <= missing; i++) {
                        int sequence = (int) existing + i;
                        String name = defaultGeneratedName(component, sequence);
                        if (instanceRepo.existsBySchool_IdAndComponent_IdAndClassGroup_IdAndSubject_IdAndNameIgnoreCase(
                                schoolId, component.getId(), classGroupId, subjectId, name)) {
                            continue;
                        }

                        AssessmentInstance instance = new AssessmentInstance();
                        instance.setSchool(requireSchool(schoolId));
                        instance.setAcademicYear(scheme.getAcademicYear());
                        instance.setScheme(scheme);
                        instance.setComponent(component);
                        instance.setName(name);
                        instance.setClassGroup(classGroupById.get(classGroupId));
                        instance.setSubject(subjectById.get(subjectId));
                        instance.setSequence(sequence);
                        instance.setMaxMarks(maxMarks);
                        instance.setStatus(AssessmentInstanceStatus.DRAFT);
                        instance.setAssessmentDate(dateOverrides.get(keyFor(component.getId(), classGroupId, subjectId, sequence)));
                        created.add(instanceRepo.save(instance));
                    }
                }
            }
        }

        return created.stream().map(this::toDTO).toList();
    }

    // ─────────────────────── Smart Schedule Candidate Generator ─────────────────

    /**
     * Generates schedule candidates without persisting them.
     * The caller reviews and edits candidates in the UI, then calls {@link #bulkSaveDrafts}.
     */
    public List<ScheduleCandidateDTO> generateScheduleCandidates(ScheduleGenerateCandidatesRequestDTO dto) {
        Integer schoolId = requireSchoolId();

        // Validate and parse componentType
        ComponentType targetType;
        try {
            targetType = ComponentType.valueOf(dto.componentType());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Unknown component type: " + dto.componentType());
        }

        // Resolve target class groups
        List<ClassGroup> targetClassGroups;
        if ("SELECTED".equals(dto.coverageMode())) {
            List<Integer> ids = dto.selectedClassSectionIds() == null ? List.of() : dto.selectedClassSectionIds();
            if (ids.isEmpty()) throw new IllegalArgumentException("selectedClassSectionIds is required when coverageMode=SELECTED");
            targetClassGroups = ids.stream().map(id -> requireClassGroup(id, schoolId)).toList();
        } else {
            // ALL_APPLICABLE: all non-deleted class groups
            targetClassGroups = classGroupRepo.findAllBySchool_IdAndIsDeletedFalseOrderByGradeLevelAscCodeAsc(schoolId);
        }

        // Load all published assignments for the academic year (any scheme)
        List<AssessmentSchemeAssignment> allAssignments = assignmentRepo.findActiveForGeneration(schoolId, dto.academicYearId(), null)
                .stream()
                .filter(a -> a.getScheme().getStatus() == AssessmentSchemeStatus.PUBLISHED)
                .toList();

        // Build candidates
        List<ScheduleCandidateDTO> candidates = new ArrayList<>();
        // For date distribution
        List<String> datePool = buildDatePool(dto);
        Map<Integer, LocalDate> subjectDateMap = new LinkedHashMap<>(); // for SAME_SUBJECT_DATE
        int[] datePoolIndex = {0};

        for (ClassGroup classGroup : targetClassGroups) {
            List<Integer> subjectIds;
            if ("SELECTED".equals(dto.subjectMode())) {
                subjectIds = dto.selectedSubjectIds() == null ? List.of() : dto.selectedSubjectIds();
            } else {
                // ALL_MAPPED: subjects from Academic Structure
                subjectIds = subjectClassGroupRepo.findSubjectIdsByClassGroup_Id(classGroup.getId());
            }

            for (Integer subjectId : subjectIds) {
                Subject subject;
                try {
                    subject = requireSubject(subjectId, schoolId);
                } catch (Exception e) {
                    continue; // skip invalid subjects
                }

                // Resolve best applicable scheme
                AssessmentScheme resolvedScheme = resolveScheme(allAssignments, classGroup, subject);
                if (resolvedScheme == null) {
                    candidates.add(new ScheduleCandidateDTO(
                            classGroup.getId(), classGroupLabel(classGroup),
                            subjectId, subject.getName(),
                            null, null, null, null, null,
                            null, dto.defaultStartTime(), dto.defaultEndTime(),
                            null, "NO_SCHEME", "No published assessment scheme applies to this class/subject.", 1));
                    continue;
                }

                // Find matching component by type
                AssessmentComponent component = resolvedScheme.getComponents().stream()
                        .filter(c -> c.getComponentType() == targetType
                                && c.getCalculationRule() != CalculationRule.ATTENDANCE_PERCENTAGE)
                        .min(Comparator.comparing(AssessmentComponent::getSequence))
                        .orElse(null);

                if (component == null) {
                    candidates.add(new ScheduleCandidateDTO(
                            classGroup.getId(), classGroupLabel(classGroup),
                            subjectId, subject.getName(),
                            resolvedScheme.getId(), resolvedScheme.getName(),
                            null, null, dto.componentType(),
                            null, dto.defaultStartTime(), dto.defaultEndTime(),
                            null, "NO_COMPONENT",
                            "Scheme '" + resolvedScheme.getName() + "' has no component of type " + dto.componentType() + ".", 1));
                    continue;
                }

                // Resolve max marks
                BigDecimal maxMarks;
                if ("MANUAL".equals(dto.maxMarksStrategy())) {
                    maxMarks = dto.manualMaxMarks();
                } else {
                    maxMarks = component.getMaxMarks();
                }
                String validationStatus = "OK";
                String validationMessage = null;
                if (maxMarks == null || maxMarks.compareTo(BigDecimal.ZERO) <= 0) {
                    validationStatus = "MISSING_MAX_MARKS";
                    validationMessage = "Max marks is not set. Please enter max marks before saving.";
                    maxMarks = null;
                }

                // Resolve date
                LocalDate date = resolveDate(dto, datePool, datePoolIndex, subjectDateMap, subjectId);

                int totalInstances = resolveInstancesToGenerate(component);
                for (int seq = 1; seq <= totalInstances; seq++) {
                    candidates.add(new ScheduleCandidateDTO(
                            classGroup.getId(), classGroupLabel(classGroup),
                            subjectId, subject.getName(),
                            resolvedScheme.getId(), resolvedScheme.getName(),
                            component.getId(), component.getName(), component.getComponentType().name(),
                            date, dto.defaultStartTime(), dto.defaultEndTime(),
                            maxMarks, validationStatus, validationMessage, seq));
                }
            }
        }

        return candidates;
    }

    /**
     * Persists a batch of schedule candidates as DRAFT assessment instances.
     * Each item must reference a valid published scheme + component.
     * Max marks may be null/0 for drafts (must be set > 0 before publishing).
     */
    @Transactional
    public List<AssessmentInstanceDTO> bulkSaveDrafts(BulkSaveDraftsRequestDTO dto) {
        Integer schoolId = requireSchoolId();
        List<AssessmentInstance> created = new ArrayList<>();

        for (BulkSaveDraftsRequestDTO.BulkSaveDraftItemDTO item : dto.candidates()) {
            AssessmentScheme scheme = requirePublishedScheme(item.schemeId(), schoolId);
            AssessmentComponent component = requireComponentOfScheme(item.componentId(), scheme.getId());
            validateComponentAllowsInstance(component);

            // Validate time window if both times given
            if (item.startTime() != null && item.endTime() != null
                    && !item.endTime().isAfter(item.startTime())) {
                throw new IllegalArgumentException("endTime must be after startTime for: " + item.name());
            }

            // Validate max marks only if non-null and non-zero
            if (item.maxMarks() != null && item.maxMarks().compareTo(BigDecimal.ZERO) < 0) {
                throw new IllegalArgumentException("maxMarks cannot be negative for: " + item.name());
            }

            AssessmentInstance instance = new AssessmentInstance();
            instance.setSchool(requireSchool(schoolId));
            instance.setAcademicYear(scheme.getAcademicYear());
            instance.setScheme(scheme);
            instance.setComponent(component);
            instance.setName(item.name().trim());
            instance.setSubject(requireSubject(item.subjectId(), schoolId));
            instance.setClassGroup(requireClassGroup(item.classGroupId(), schoolId));
            instance.setAssessmentDate(item.assessmentDate());
            instance.setStartTime(item.startTime());
            instance.setEndTime(item.endTime());
            instance.setRoom(item.roomId() != null ? requireRoom(item.roomId(), schoolId) : null);
            // Use ZERO as placeholder; publish validates > 0
            instance.setMaxMarks(item.maxMarks() != null && item.maxMarks().compareTo(BigDecimal.ZERO) > 0
                    ? item.maxMarks() : BigDecimal.ZERO);
            instance.setSequence(item.sequence() != null ? item.sequence() : 1);
            instance.setStatus(AssessmentInstanceStatus.DRAFT);

            created.add(instanceRepo.save(instance));
        }

        return created.stream().map(this::toDTO).toList();
    }

    // ─────────────────────── Bulk Publish Drafts ─────────────────────────────

    /**
     * Publishes (moves to SCHEDULED) multiple DRAFT assessment instances in one call.
     * Instances that fail validation are reported but do not prevent others from being published.
     * If ALL instances fail, an exception is thrown.
     */
    @Transactional
    public ExamBulkPublishResultDTO bulkPublishAssessments(BulkPublishRequestDTO dto) {
        Integer schoolId = requireSchoolId();
        List<AssessmentInstanceDTO> published = new ArrayList<>();
        List<String> errors = new ArrayList<>();

        for (Integer id : dto.assessmentIds()) {
            try {
                AssessmentInstance instance = requireInstance(id, schoolId);
                if (instance.getStatus() != AssessmentInstanceStatus.DRAFT) {
                    errors.add("Assessment #" + id + " (" + instance.getName() + "): not in DRAFT status");
                    continue;
                }
                if (instance.getAssessmentDate() == null) {
                    errors.add("Assessment #" + id + " (" + instance.getName() + "): exam date required");
                    continue;
                }
                if (instance.getStartTime() == null || instance.getEndTime() == null) {
                    errors.add("Assessment #" + id + " (" + instance.getName() + "): start and end time required");
                    continue;
                }
                if (!instance.getEndTime().isAfter(instance.getStartTime())) {
                    errors.add("Assessment #" + id + " (" + instance.getName() + "): end time must be after start time");
                    continue;
                }
                if (instance.getMaxMarks() == null || instance.getMaxMarks().compareTo(BigDecimal.ZERO) <= 0) {
                    errors.add("Assessment #" + id + " (" + instance.getName() + "): max marks must be > 0");
                    continue;
                }
                instance.setStatus(AssessmentInstanceStatus.SCHEDULED);
                published.add(toDTO(instanceRepo.save(instance)));
            } catch (Exception e) {
                errors.add("Assessment #" + id + ": " + e.getMessage());
            }
        }

        return new ExamBulkPublishResultDTO(published.size(), errors.size(), errors, published);
    }

    /**
     * Inline response record for bulk-publish results.
     */
    public record ExamBulkPublishResultDTO(
            int publishedCount,
            int failedCount,
            List<String> errors,
            List<AssessmentInstanceDTO> published
    ) {}

    // ─────────────────────── Full Auto-Generate from Schemes ─────────────────

    /**
     * Generates draft assessment instances for ALL class-sections × subjects
     * using the published assessment scheme override hierarchy.
     *
     * <p>Admin only provides scheduling-level inputs (academic year, schedule name,
     * optional date window, default times, room strategy, date strategy).
     * The system resolves which scheme and components apply to each combination.
     *
     * <p>Only components where {@code requiresScheduling = true} and the calculation
     * rule is not {@link CalculationRule#ATTENDANCE_PERCENTAGE} are scheduled.
     *
     * <p>Existing drafts for the same component + class-section + subject are skipped
     * to avoid duplicates.
     */
    @Transactional
    public ExamScheduleGenerateResponseDTO generateFromSchemes(ExamScheduleGenerateRequestDTO req) {
        Integer schoolId = requireSchoolId();
        String groupId = req.scheduleName().trim().replaceAll("\\s+", "-").toLowerCase()
                + "-" + UUID.randomUUID().toString().substring(0, 8);

        // Load all non-deleted class groups for this school
        List<ClassGroup> classGroups =
                classGroupRepo.findAllBySchool_IdAndIsDeletedFalseOrderByGradeLevelAscCodeAsc(schoolId);

        // Load all published scheme assignments for the academic year
        List<AssessmentSchemeAssignment> allAssignments =
                assignmentRepo.findActiveForGeneration(schoolId, req.academicYearId(), null)
                        .stream()
                        .filter(a -> a.getScheme().getStatus() == AssessmentSchemeStatus.PUBLISHED)
                        .toList();

        // Resolve published timetable version (optional – used for DELEGATED scheduling owner)
        Integer publishedTtVersionId = timetableVersionRepo
                .findTopBySchool_IdAndStatusOrderByVersionDesc(schoolId,
                        com.myhaimi.sms.entity.TimetableStatus.PUBLISHED)
                .map(tv -> tv.getId())
                .orElse(null);

        // Build date pool
        List<LocalDate> datePool = buildDatePoolDates(req.dateWindowFrom(), req.dateWindowTo());
        Map<Integer, LocalDate> subjectDateMap = new LinkedHashMap<>();
        int[] dateIndex = {0};

        // Parse default times once
        LocalTime defStart = parseTime(req.defaultStartTime());
        LocalTime defEnd = parseTime(req.defaultEndTime());
        String roomStrategy = req.roomStrategy() == null ? "LEAVE_BLANK" : req.roomStrategy();
        String dateStrategy = req.dateStrategy() == null ? "LEAVE_BLANK" : req.dateStrategy();

        List<AssessmentInstance> created = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        int skipped = 0, missingScheme = 0, notSchedulable = 0;

        for (ClassGroup classGroup : classGroups) {
            List<Integer> subjectIds =
                    subjectClassGroupRepo.findSubjectIdsByClassGroup_Id(classGroup.getId());

            for (Integer subjectId : subjectIds) {
                Subject subject;
                try { subject = requireSubject(subjectId, schoolId); }
                catch (Exception e) { skipped++; continue; }

                // Resolve the best applicable published scheme
                AssessmentScheme scheme = resolveScheme(allAssignments, classGroup, subject);
                if (scheme == null) {
                    warnings.add("No published scheme for " + classGroupLabel(classGroup)
                            + " / " + subject.getName());
                    missingScheme++;
                    continue;
                }

                // Determine scheduling owner from published timetable (DELEGATED components)
                Integer teacherStaffId = null;
                if (publishedTtVersionId != null) {
                    List<Integer> staffIds = timetableEntryRepo.findStaffIdsByClassGroupAndSubject(
                            schoolId, publishedTtVersionId, classGroup.getId(), subjectId);
                    if (!staffIds.isEmpty()) teacherStaffId = staffIds.get(0);
                }

                // Resolve room from strategy
                Room room = null;
                if ("USE_HOMEROOM".equals(roomStrategy)) {
                    room = classGroup.getDefaultRoom();
                }

                for (AssessmentComponent component : scheme.getComponents()) {
                    if (!isSchedulable(component)) {
                        notSchedulable++;
                        continue;
                    }

                    int total = resolveInstancesToGenerate(component);
                    BigDecimal maxMarks = component.getMaxMarks();
                    if (maxMarks == null || maxMarks.compareTo(BigDecimal.ZERO) <= 0) {
                        maxMarks = BigDecimal.ZERO; // draft – admin must set before publish
                    }

                    for (int seq = 1; seq <= total; seq++) {
                        String name = defaultGeneratedName(component, seq);

                        // Skip if already exists
                        if (instanceRepo.existsBySchool_IdAndComponent_IdAndClassGroup_IdAndSubject_IdAndNameIgnoreCase(
                                schoolId, component.getId(), classGroup.getId(), subjectId, name)) {
                            skipped++;
                            continue;
                        }

                        LocalDate date = resolveGenerateDate(
                                dateStrategy, datePool, dateIndex, subjectDateMap, subjectId);

                        AssessmentInstance inst = new AssessmentInstance();
                        inst.setSchool(requireSchool(schoolId));
                        inst.setAcademicYear(scheme.getAcademicYear());
                        inst.setScheme(scheme);
                        inst.setComponent(component);
                        inst.setName(name);
                        inst.setSubject(subject);
                        inst.setClassGroup(classGroup);
                        inst.setSequence(seq);
                        inst.setMaxMarks(maxMarks);
                        inst.setStatus(AssessmentInstanceStatus.DRAFT);
                        inst.setAssessmentDate(date);
                        inst.setStartTime(defStart);
                        inst.setEndTime(defEnd);
                        inst.setRoom(room);
                        inst.setScheduleGroupId(groupId);

                        created.add(instanceRepo.save(inst));
                    }
                }
            }
        }

        List<AssessmentInstanceDTO> dtos = created.stream().map(this::toDTO).toList();
        return new ExamScheduleGenerateResponseDTO(
                groupId, created.size(), skipped, missingScheme, notSchedulable, warnings, dtos);
    }

    /** Returns true when a component should produce a scheduled exam row. */
    private boolean isSchedulable(AssessmentComponent component) {
        if (component.getComponentType() == ComponentType.ATTENDANCE) return false;
        if (component.getCalculationRule() == CalculationRule.ATTENDANCE_PERCENTAGE) return false;
        return component.isRequiresScheduling();
    }

    private List<LocalDate> buildDatePoolDates(LocalDate from, LocalDate to) {
        if (from == null || to == null) return List.of();
        List<LocalDate> pool = new ArrayList<>();
        LocalDate d = from;
        while (!d.isAfter(to)) { pool.add(d); d = d.plusDays(1); }
        return pool;
    }

    private LocalDate resolveGenerateDate(
            String mode, List<LocalDate> pool, int[] idx,
            Map<Integer, LocalDate> subjectMap, Integer subjectId) {
        if ("LEAVE_BLANK".equals(mode) || pool.isEmpty()) return null;
        if ("SAME_SUBJECT_DATE".equals(mode)) {
            return subjectMap.computeIfAbsent(subjectId, k -> nextDate(pool, idx));
        }
        return nextDate(pool, idx);
    }

    private LocalDate nextDate(List<LocalDate> pool, int[] idx) {
        if (idx[0] >= pool.size()) idx[0] = 0;
        return pool.get(idx[0]++);
    }

    private LocalTime parseTime(String hhmm) {
        if (hhmm == null || hhmm.isBlank()) return null;
        try { return LocalTime.parse(hhmm, DateTimeFormatter.ofPattern("HH:mm")); }
        catch (Exception e) { return null; }
    }

    // ─────────────────────── Scheme Override Resolver ────────────────────────

    /**
     * Returns the most specific published assessment scheme for the given class group and subject,
     * using the override hierarchy:
     * SECTION_SUBJECT (6) > CLASS_SUBJECT (5) > SUBJECT (4) > SECTION (3) > CLASS (2) > SCHOOL (1).
     */
    private AssessmentScheme resolveScheme(
            List<AssessmentSchemeAssignment> assignments,
            ClassGroup classGroup,
            Subject subject) {
        AssessmentSchemeAssignment best = null;
        int bestScore = 0;
        for (AssessmentSchemeAssignment a : assignments) {
            int score = scoreScopeMatch(a, classGroup, subject);
            if (score > bestScore) {
                bestScore = score;
                best = a;
            }
        }
        return best != null ? best.getScheme() : null;
    }

    private int scoreScopeMatch(AssessmentSchemeAssignment a, ClassGroup classGroup, Subject subject) {
        return switch (a.getScopeType()) {
            case SCHOOL -> 1;
            case CLASS -> (a.getClassGroup() != null
                    && Objects.equals(a.getClassGroup().getGradeLevel(), classGroup.getGradeLevel())) ? 2 : 0;
            case SECTION -> (a.getClassGroup() != null
                    && Objects.equals(a.getClassGroup().getId(), classGroup.getId())) ? 3 : 0;
            case SUBJECT -> (a.getSubject() != null
                    && Objects.equals(a.getSubject().getId(), subject.getId())) ? 4 : 0;
            case CLASS_SUBJECT -> (a.getClassGroup() != null && a.getSubject() != null
                    && Objects.equals(a.getClassGroup().getGradeLevel(), classGroup.getGradeLevel())
                    && Objects.equals(a.getSubject().getId(), subject.getId())) ? 5 : 0;
            case SECTION_SUBJECT -> (a.getClassGroup() != null && a.getSubject() != null
                    && Objects.equals(a.getClassGroup().getId(), classGroup.getId())
                    && Objects.equals(a.getSubject().getId(), subject.getId())) ? 6 : 0;
        };
    }

    // ─────────────────────────── Date Distribution ───────────────────────────

    private List<String> buildDatePool(ScheduleGenerateCandidatesRequestDTO dto) {
        if (dto.dateWindowFrom() == null || dto.dateWindowTo() == null) return List.of();
        List<String> pool = new ArrayList<>();
        LocalDate d = dto.dateWindowFrom();
        while (!d.isAfter(dto.dateWindowTo())) {
            pool.add(d.toString());
            d = d.plusDays(1);
        }
        return pool;
    }

    private LocalDate resolveDate(
            ScheduleGenerateCandidatesRequestDTO dto,
            List<String> datePool,
            int[] datePoolIndex,
            Map<Integer, LocalDate> subjectDateMap,
            Integer subjectId) {
        String mode = dto.dateDistributionMode() == null ? "LEAVE_BLANK" : dto.dateDistributionMode();
        if ("LEAVE_BLANK".equals(mode) || datePool.isEmpty()) return null;
        if ("SAME_SUBJECT_DATE".equals(mode)) {
            return subjectDateMap.computeIfAbsent(subjectId, k -> {
                if (datePoolIndex[0] >= datePool.size()) datePoolIndex[0] = 0;
                LocalDate date = LocalDate.parse(datePool.get(datePoolIndex[0]));
                datePoolIndex[0]++;
                return date;
            });
        }
        // AUTO_DISTRIBUTE
        if (datePoolIndex[0] >= datePool.size()) datePoolIndex[0] = 0;
        LocalDate date = LocalDate.parse(datePool.get(datePoolIndex[0]));
        datePoolIndex[0]++;
        return date;
    }

    private String classGroupLabel(ClassGroup cg) {
        if (cg.getDisplayName() != null && !cg.getDisplayName().isBlank()) return cg.getDisplayName();
        return cg.getCode();
    }

    private int resolveInstancesToGenerate(AssessmentComponent component) {
        CalculationRule rule = component.getCalculationRule();
        if (rule == CalculationRule.SINGLE_ASSESSMENT || rule == CalculationRule.HIGHEST || rule == CalculationRule.MANUAL) {
            return 1;
        }
        if (rule == CalculationRule.BEST_N_OF_M || rule == CalculationRule.SUM || rule == CalculationRule.AVERAGE) {
            Integer total = component.getTotalAssessments();
            if (total == null || total <= 0) {
                throw new IllegalStateException("Component '" + component.getName() + "' requires totalAssessments");
            }
            return total;
        }
        return 1;
    }

    private void ensureEditable(AssessmentInstance instance) {
        if (instance.getStatus() == AssessmentInstanceStatus.LOCKED || instance.getStatus() == AssessmentInstanceStatus.PUBLISHED) {
            throw new IllegalStateException("Cannot edit assessment in status " + instance.getStatus());
        }
    }

    private void applyCreatePayload(AssessmentInstance instance, AssessmentInstanceCreateDTO dto, Integer schoolId) {
        instance.setName(dto.name().trim());
        instance.setSubject(requireSubject(dto.subjectId(), schoolId));
        instance.setClassGroup(requireClassGroup(dto.classGroupId(), schoolId));
        instance.setAssessmentDate(dto.assessmentDate());
        instance.setStartTime(dto.startTime());
        instance.setEndTime(dto.endTime());
        instance.setRoom(dto.roomId() == null ? null : requireRoom(dto.roomId(), schoolId));
        instance.setMaxMarks(requireMaxMarks(dto.maxMarks()));
        instance.setSequence(dto.sequence());
        validateTimeWindow(instance);
    }

    private void applyUpdatePayload(AssessmentInstance instance, AssessmentInstanceUpdateDTO dto, Integer schoolId) {
        instance.setName(dto.name().trim());
        instance.setSubject(requireSubject(dto.subjectId(), schoolId));
        instance.setClassGroup(requireClassGroup(dto.classGroupId(), schoolId));
        instance.setAssessmentDate(dto.assessmentDate());
        instance.setStartTime(dto.startTime());
        instance.setEndTime(dto.endTime());
        instance.setRoom(dto.roomId() == null ? null : requireRoom(dto.roomId(), schoolId));
        instance.setMaxMarks(requireMaxMarks(dto.maxMarks()));
        instance.setSequence(dto.sequence());
        if (dto.instructions() != null) instance.setInstructions(dto.instructions());
        validateTimeWindow(instance);
    }

    private BigDecimal requireMaxMarks(BigDecimal maxMarks) {
        if (maxMarks == null || maxMarks.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("maxMarks is required and must be greater than 0");
        }
        return maxMarks;
    }

    private void validateTimeWindow(AssessmentInstance instance) {
        if (instance.getStartTime() != null && instance.getEndTime() != null
                && !instance.getEndTime().isAfter(instance.getStartTime())) {
            throw new IllegalArgumentException("endTime must be after startTime");
        }
    }

    private void validateDuplicateName(
            Integer assessmentId,
            Integer schoolId,
            Integer componentId,
            Integer classGroupId,
            Integer subjectId,
            String name
    ) {
        boolean exists = assessmentId == null
                ? instanceRepo.existsBySchool_IdAndComponent_IdAndClassGroup_IdAndSubject_IdAndNameIgnoreCase(
                schoolId, componentId, classGroupId, subjectId, name.trim())
                : instanceRepo.existsBySchool_IdAndComponent_IdAndClassGroup_IdAndSubject_IdAndNameIgnoreCaseAndIdNot(
                schoolId, componentId, classGroupId, subjectId, name.trim(), assessmentId);
        if (exists) {
            throw new IllegalArgumentException("Assessment name already exists for this component, class, and subject");
        }
    }

    private void validateAssessmentCountLimit(
            Integer schoolId,
            AssessmentComponent component,
            Integer classGroupId,
            Integer subjectId,
            Integer excludeAssessmentId
    ) {
        if (component.getCalculationRule() != CalculationRule.BEST_N_OF_M
                && component.getCalculationRule() != CalculationRule.SUM
                && component.getCalculationRule() != CalculationRule.AVERAGE) {
            return;
        }
        Integer totalAllowed = component.getTotalAssessments();
        if (totalAllowed == null || totalAllowed <= 0) {
            throw new IllegalStateException("Component totalAssessments is required for this calculation rule");
        }

        long existing = instanceRepo.countBySchool_IdAndComponent_IdAndClassGroup_IdAndSubject_IdAndStatusNot(
                schoolId,
                component.getId(),
                classGroupId,
                subjectId,
                AssessmentInstanceStatus.CANCELLED
        );

        if (excludeAssessmentId != null) {
            AssessmentInstance self = instanceRepo.findById(excludeAssessmentId)
                    .orElseThrow(() -> new NoSuchElementException("Assessment not found"));
            if (Objects.equals(self.getComponent().getId(), component.getId())
                    && Objects.equals(self.getClassGroup().getId(), classGroupId)
                    && Objects.equals(self.getSubject().getId(), subjectId)
                    && self.getStatus() != AssessmentInstanceStatus.CANCELLED) {
                existing = Math.max(existing - 1, 0);
            }
        }

        if (existing >= totalAllowed) {
            throw new IllegalArgumentException("Assessment count exceeds configured totalAssessments for this component");
        }
    }

    private AssessmentScheme requirePublishedScheme(Integer schemeId, Integer schoolId) {
        AssessmentScheme scheme = schemeRepo.findByIdAndSchool_Id(schemeId, schoolId)
                .orElseThrow(() -> new NoSuchElementException("Assessment scheme not found"));
        if (scheme.getStatus() == AssessmentSchemeStatus.ARCHIVED) {
            throw new IllegalStateException("Cannot schedule assessments for archived scheme");
        }
        if (scheme.getStatus() != AssessmentSchemeStatus.PUBLISHED) {
            throw new IllegalStateException("Only PUBLISHED schemes can be scheduled");
        }
        return scheme;
    }

    private AssessmentComponent requireComponentOfScheme(Integer componentId, Integer schemeId) {
        AssessmentComponent component = componentRepo.findByIdAndScheme_Id(componentId, schemeId)
                .orElseThrow(() -> new NoSuchElementException("Assessment component not found"));
        if (component.getScheme() == null || !Objects.equals(component.getScheme().getId(), schemeId)) {
            throw new IllegalArgumentException("Component does not belong to the selected scheme");
        }
        return component;
    }

    private void validateComponentAllowsInstance(AssessmentComponent component) {
        if (component.getCalculationRule() == CalculationRule.ATTENDANCE_PERCENTAGE) {
            throw new IllegalArgumentException("ATTENDANCE_PERCENTAGE component does not create assessment instances");
        }
    }

    private AssessmentInstance requireInstance(Integer assessmentId, Integer schoolId) {
        return instanceRepo.findByIdAndSchool_Id(assessmentId, schoolId)
                .orElseThrow(() -> new NoSuchElementException("Assessment instance not found"));
    }

    private School requireSchool(Integer schoolId) {
        return schoolRepo.findById(schoolId)
                .orElseThrow(() -> new NoSuchElementException("School not found"));
    }

    private Subject requireSubject(Integer subjectId, Integer schoolId) {
        Subject subject = subjectRepo.findById(subjectId)
                .orElseThrow(() -> new NoSuchElementException("Subject not found"));
        if (!Objects.equals(subject.getSchool().getId(), schoolId) || subject.isDeleted()) {
            throw new IllegalArgumentException("Subject does not belong to this school");
        }
        return subject;
    }

    private ClassGroup requireClassGroup(Integer classGroupId, Integer schoolId) {
        ClassGroup classGroup = classGroupRepo.findById(classGroupId)
                .orElseThrow(() -> new NoSuchElementException("Class group not found"));
        if (!Objects.equals(classGroup.getSchool().getId(), schoolId) || classGroup.isDeleted()) {
            throw new IllegalArgumentException("Class group does not belong to this school");
        }
        return classGroup;
    }

    private Room requireRoom(Integer roomId, Integer schoolId) {
        Room room = roomRepo.findById(roomId)
                .orElseThrow(() -> new NoSuchElementException("Room not found"));
        if (!Objects.equals(room.getSchool().getId(), schoolId) || room.isDeleted()) {
            throw new IllegalArgumentException("Room does not belong to this school");
        }
        return room;
    }

    private Integer requireSchoolId() {
        Integer schoolId = TenantContext.getTenantId();
        if (schoolId == null) throw new IllegalStateException("Missing school context");
        return schoolId;
    }

    private String defaultGeneratedName(AssessmentComponent component, int sequence) {
        if (sequence <= 1 && component.getCalculationRule() == CalculationRule.SINGLE_ASSESSMENT) {
            return component.getName();
        }
        return component.getName() + " " + sequence;
    }

    private String keyFor(Integer componentId, Integer classGroupId, Integer subjectId, Integer sequence) {
        return componentId + ":" + classGroupId + ":" + subjectId + ":" + sequence;
    }

    private AssessmentInstanceDTO toDTO(AssessmentInstance ai) {
        AcademicYear ay = ai.getAcademicYear();
        Subject subject = ai.getSubject();
        ClassGroup classGroup = ai.getClassGroup();
        Room room = ai.getRoom();

        String classLabel = classGroup.getDisplayName();
        if (classLabel == null || classLabel.isBlank()) {
            classLabel = classGroup.getCode();
        }

        String roomLabel = null;
        if (room != null) {
            roomLabel = room.getBuilding() + " / " + room.getRoomNumber();
        }

        return new AssessmentInstanceDTO(
                ai.getId(),
                ai.getSchool().getId(),
                ay.getId(),
                ay.getLabel(),
                ai.getScheme().getId(),
                ai.getScheme().getName(),
                ai.getComponent().getId(),
                ai.getComponent().getName(),
                ai.getComponent().getComponentType().name(),
                ai.getName(),
                subject.getId(),
                subject.getName(),
                classGroup.getId(),
                classLabel,
                ai.getAssessmentDate(),
                ai.getStartTime(),
                ai.getEndTime(),
                room == null ? null : room.getId(),
                roomLabel,
                ai.getMaxMarks(),
                ai.getStatus(),
                ai.getSequence(),
                ai.getScheduleGroupId(),
                ai.getInstructions(),
                ai.getCreatedAt(),
                ai.getUpdatedAt()
        );
    }
}


