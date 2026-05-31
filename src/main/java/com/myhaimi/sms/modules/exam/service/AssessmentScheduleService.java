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
import com.myhaimi.sms.modules.exam.entity.AssessmentComponent;
import com.myhaimi.sms.modules.exam.entity.AssessmentInstance;
import com.myhaimi.sms.modules.exam.entity.AssessmentScheme;
import com.myhaimi.sms.modules.exam.entity.AssessmentSchemeAssignment;
import com.myhaimi.sms.modules.exam.entity.enums.AssessmentInstanceStatus;
import com.myhaimi.sms.modules.exam.entity.enums.AssessmentSchemeStatus;
import com.myhaimi.sms.modules.exam.entity.enums.CalculationRule;
import com.myhaimi.sms.modules.exam.repository.AssessmentComponentRepository;
import com.myhaimi.sms.modules.exam.repository.AssessmentInstanceRepository;
import com.myhaimi.sms.modules.exam.repository.AssessmentSchemeAssignmentRepository;
import com.myhaimi.sms.modules.exam.repository.AssessmentSchemeRepository;
import com.myhaimi.sms.repository.ClassGroupRepo;
import com.myhaimi.sms.repository.RoomRepo;
import com.myhaimi.sms.repository.SchoolRepo;
import com.myhaimi.sms.repository.SubjectRepo;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Objects;

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
                ai.getCreatedAt(),
                ai.getUpdatedAt()
        );
    }
}


