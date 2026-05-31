package com.myhaimi.sms.modules.exam.service;

import com.myhaimi.sms.entity.AcademicYear;
import com.myhaimi.sms.entity.ClassGroup;
import com.myhaimi.sms.entity.School;
import com.myhaimi.sms.entity.Subject;
import com.myhaimi.sms.modules.exam.dto.*;
import com.myhaimi.sms.modules.exam.entity.*;
import com.myhaimi.sms.modules.exam.entity.enums.AssessmentSchemeStatus;
import com.myhaimi.sms.modules.exam.entity.enums.CalculationRule;
import com.myhaimi.sms.modules.exam.entity.enums.ExamApplicableScopeType;
import com.myhaimi.sms.modules.exam.repository.*;
import com.myhaimi.sms.repository.AcademicYearRepo;
import com.myhaimi.sms.repository.ClassGroupRepo;
import com.myhaimi.sms.repository.SchoolRepo;
import com.myhaimi.sms.repository.SubjectRepo;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AssessmentSchemeService {

    private final AssessmentSchemeRepository schemeRepo;
    private final AssessmentComponentRepository componentRepo;
    private final AssessmentSchemeAssignmentRepository assignmentRepo;
    private final GradingSchemeRepository gradingSchemeRepo;
    private final GradingBandRepository gradingBandRepo;
    private final SchoolRepo schoolRepo;
    private final AcademicYearRepo academicYearRepo;
    private final ClassGroupRepo classGroupRepo;
    private final SubjectRepo subjectRepo;

    // ────────��────────────────────── Scheme CRUD ──────────────────────────────

    @Transactional
    public AssessmentSchemeDTO createScheme(AssessmentSchemeCreateDTO dto) {
        Integer schoolId = requireSchoolId();
        School school = requireSchool(schoolId);
        AcademicYear ay = requireAcademicYear(dto.academicYearId(), schoolId);

        AssessmentScheme scheme = new AssessmentScheme();
        scheme.setSchool(school);
        scheme.setAcademicYear(ay);
        scheme.setName(dto.name().trim());
        scheme.setDescription(dto.description());
        scheme.setStatus(AssessmentSchemeStatus.DRAFT);
        scheme.setVersionNo(1);
        scheme = schemeRepo.save(scheme);

        if (dto.components() != null) {
            for (AssessmentComponentCreateDTO compDto : dto.components()) {
                validateComponentCreate(scheme, compDto, null);
                AssessmentComponent comp = new AssessmentComponent();
                comp.setScheme(scheme);
                mapComponentFields(comp, compDto);
                componentRepo.save(comp);
                scheme.getComponents().add(comp);
            }
        }

        if (dto.assignments() != null) {
            for (AssessmentSchemeAssignmentCreateDTO assignmentDto : dto.assignments()) {
                createAssignmentEntity(scheme, assignmentDto, schoolId, ay);
            }
        }

        return toDTO(schemeRepo.findByIdAndSchool_Id(scheme.getId(), schoolId).orElseThrow());
    }

    @Transactional
    public AssessmentSchemeDTO updateScheme(Integer schemeId, AssessmentSchemeUpdateDTO dto) {
        AssessmentScheme scheme = requireDraftScheme(schemeId);
        scheme.setName(dto.name().trim());
        scheme.setDescription(dto.description());
        return toDTO(schemeRepo.save(scheme));
    }

    public List<AssessmentSchemeDTO> listSchemes() {
        Integer schoolId = requireSchoolId();
        return schemeRepo.findBySchool_IdOrderByCreatedAtDesc(schoolId).stream()
                .filter(s -> !(s.getComponents().isEmpty() && looksLikeBadMultiSchemeDraft(s.getName())))
                .map(this::toDTO)
                .toList();
    }

    public AssessmentSchemeDTO getScheme(Integer schemeId) {
        Integer schoolId = requireSchoolId();
        AssessmentScheme scheme = schemeRepo.findByIdAndSchool_Id(schemeId, schoolId)
                .orElseThrow(() -> new NoSuchElementException("Assessment scheme not found"));
        return toDTO(scheme);
    }

    // ─────────────────────────────── Assignments ────────���─────────────────────

    @Transactional
    public AssessmentSchemeDTO addAssignment(Integer schemeId, AssessmentSchemeAssignmentCreateDTO dto) {
        AssessmentScheme scheme = requireDraftScheme(schemeId);
        createAssignmentEntity(scheme, dto, requireSchoolId(), scheme.getAcademicYear());
        return toDTO(schemeRepo.findByIdAndSchool_Id(schemeId, requireSchoolId()).orElseThrow());
    }

    @Transactional
    public void deleteAssignment(Integer schemeId, Integer assignmentId) {
        Integer schoolId = requireSchoolId();
        requireDraftScheme(schemeId);
        AssessmentSchemeAssignment a = assignmentRepo.findByIdAndScheme_IdAndSchool_Id(assignmentId, schemeId, schoolId)
                .orElseThrow(() -> new NoSuchElementException("Assignment not found"));
        assignmentRepo.delete(a);
    }

    private AssessmentSchemeAssignment createAssignmentEntity(
            AssessmentScheme scheme,
            AssessmentSchemeAssignmentCreateDTO dto,
            Integer schoolId,
            AcademicYear ay
    ) {
        validateAssignmentPayload(dto);

        ClassGroup classGroup = dto.classGroupId() == null ? null : requireClassGroup(dto.classGroupId(), schoolId);
        Subject subject = dto.subjectId() == null ? null : requireSubject(dto.subjectId(), schoolId);

        Integer classGroupId = classGroup == null ? null : classGroup.getId();
        Integer subjectId = subject == null ? null : subject.getId();
        List<AssessmentSchemeAssignment> conflicts = assignmentRepo.findConflicts(
                schoolId, ay.getId(), dto.scopeType(), classGroupId, subjectId, scheme.getId());
        if (!conflicts.isEmpty()) {
            throw new IllegalStateException("Another active assessment scheme is already assigned to this target with scope " + dto.scopeType());
        }

        AssessmentSchemeAssignment a = new AssessmentSchemeAssignment();
        a.setSchool(scheme.getSchool());
        a.setScheme(scheme);
        a.setAcademicYear(ay);
        a.setScopeType(dto.scopeType());
        a.setClassGroup(classGroup);
        a.setSubject(subject);
        a.setActive(true);
        return assignmentRepo.save(a);
    }

    private void validateAssignmentPayload(AssessmentSchemeAssignmentCreateDTO dto) {
        ExamApplicableScopeType type = dto.scopeType();
        boolean hasClass = dto.classGroupId() != null;
        boolean hasSubject = dto.subjectId() != null;
        switch (type) {
            case SCHOOL -> {
                if (hasClass || hasSubject) throw new IllegalArgumentException("SCHOOL assignment cannot include classGroupId or subjectId");
            }
            case CLASS, SECTION -> {
                if (!hasClass || hasSubject) throw new IllegalArgumentException(type + " assignment requires classGroupId only");
            }
            case SUBJECT -> {
                if (hasClass || !hasSubject) throw new IllegalArgumentException("SUBJECT assignment requires subjectId only");
            }
            case CLASS_SUBJECT, SECTION_SUBJECT -> {
                if (!hasClass || !hasSubject) throw new IllegalArgumentException(type + " assignment requires classGroupId and subjectId");
            }
        }
    }

    // ─────────────────────────────── Component CRUD ───────────────────────────

    @Transactional
    public AssessmentSchemeDTO addComponent(Integer schemeId, AssessmentComponentCreateDTO dto) {
        AssessmentScheme scheme = requireDraftScheme(schemeId);
        validateComponentCreate(scheme, dto, null);
        AssessmentComponent comp = new AssessmentComponent();
        comp.setScheme(scheme);
        mapComponentFields(comp, dto);
        componentRepo.save(comp);
        return toDTO(schemeRepo.findByIdAndSchool_Id(schemeId, requireSchoolId()).orElseThrow());
    }

    @Transactional
    public AssessmentSchemeDTO updateComponent(Integer schemeId, Integer componentId, AssessmentComponentCreateDTO dto) {
        AssessmentScheme scheme = requireDraftScheme(schemeId);
        AssessmentComponent comp = componentRepo.findByIdAndScheme_Id(componentId, schemeId)
                .orElseThrow(() -> new NoSuchElementException("Component not found"));
        validateComponentCreate(scheme, dto, componentId);
        mapComponentFields(comp, dto);
        componentRepo.save(comp);
        return toDTO(schemeRepo.findByIdAndSchool_Id(schemeId, requireSchoolId()).orElseThrow());
    }

    @Transactional
    public void removeComponent(Integer schemeId, Integer componentId) {
        requireDraftScheme(schemeId);
        AssessmentComponent comp = componentRepo.findByIdAndScheme_Id(componentId, schemeId)
                .orElseThrow(() -> new NoSuchElementException("Component not found"));
        componentRepo.delete(comp);
    }

    // ─────────────────────────────── Lifecycle ────────────────────────────────

    @Transactional
    public AssessmentSchemeDTO publishScheme(Integer schemeId) {
        AssessmentScheme scheme = requireDraftScheme(schemeId);
        validateScheme(scheme);
        scheme.setStatus(AssessmentSchemeStatus.PUBLISHED);
        scheme.setPublishedAt(Instant.now());
        return toDTO(schemeRepo.save(scheme));
    }

    @Transactional
    public AssessmentSchemeDTO archiveScheme(Integer schemeId) {
        Integer schoolId = requireSchoolId();
        AssessmentScheme scheme = schemeRepo.findByIdAndSchool_Id(schemeId, schoolId)
                .orElseThrow(() -> new NoSuchElementException("Assessment scheme not found"));
        if (scheme.getStatus() == AssessmentSchemeStatus.ARCHIVED) throw new IllegalStateException("Scheme is already archived");
        scheme.setStatus(AssessmentSchemeStatus.ARCHIVED);
        scheme.setArchivedAt(Instant.now());
        return toDTO(schemeRepo.save(scheme));
    }

    @Transactional
    public AssessmentSchemeDTO cloneScheme(Integer schemeId) {
        Integer schoolId = requireSchoolId();
        AssessmentScheme source = schemeRepo.findByIdAndSchool_Id(schemeId, schoolId)
                .orElseThrow(() -> new NoSuchElementException("Assessment scheme not found"));
        if (source.getStatus() != AssessmentSchemeStatus.PUBLISHED) throw new IllegalStateException("Only PUBLISHED schemes can be cloned");

        AssessmentScheme clone = new AssessmentScheme();
        clone.setSchool(source.getSchool());
        clone.setAcademicYear(source.getAcademicYear());
        clone.setName(source.getName() + " (Copy)");
        clone.setDescription(source.getDescription());
        clone.setStatus(AssessmentSchemeStatus.DRAFT);
        clone.setVersionNo(source.getVersionNo() + 1);
        clone = schemeRepo.save(clone);

        for (AssessmentComponent src : source.getComponents()) {
            AssessmentComponent c = new AssessmentComponent();
            c.setScheme(clone);
            c.setName(src.getName());
            c.setComponentType(src.getComponentType());
            c.setWeightagePercent(src.getWeightagePercent());
            c.setMaxMarks(src.getMaxMarks());
            c.setCalculationRule(src.getCalculationRule());
            c.setTotalAssessments(src.getTotalAssessments());
            c.setBestOfCount(src.getBestOfCount());
            c.setSequence(src.getSequence());
            c.setMandatory(src.isMandatory());
            componentRepo.save(c);
        }
        return toDTO(schemeRepo.findById(clone.getId()).orElseThrow());
    }

    // ─────────────────────────────── Grading Schemes ─────────────────────────

    public List<GradingSchemeDTO> listGradingSchemes() {
        Integer schoolId = requireSchoolId();
        return gradingSchemeRepo.findBySchool_IdOrderByCreatedAtAsc(schoolId).stream().map(this::toGradingDTO).toList();
    }

    @Transactional
    public GradingSchemeDTO createGradingScheme(GradingSchemeCreateDTO dto) {
        Integer schoolId = requireSchoolId();
        School school = requireSchool(schoolId);
        AcademicYear ay = dto.academicYearId() == null ? null : requireAcademicYear(dto.academicYearId(), schoolId);
        GradingScheme gs = new GradingScheme();
        gs.setSchool(school);
        gs.setAcademicYear(ay);
        gs.setName(dto.name().trim());
        gs.setActive(dto.active());
        gs = gradingSchemeRepo.save(gs);
        int seq = 1;
        for (GradingBandCreateDTO b : dto.bands()) {
            GradingBand band = new GradingBand();
            band.setGradingScheme(gs);
            band.setGrade(b.grade().trim());
            band.setMinPercent(b.minPercent());
            band.setMaxPercent(b.maxPercent());
            band.setGradePoint(b.gradePoint());
            band.setRemarks(b.remarks());
            band.setSequence(b.sequence() != null ? b.sequence() : seq++);
            gradingBandRepo.save(band);
        }
        return toGradingDTO(gradingSchemeRepo.findById(gs.getId()).orElseThrow());
    }

    // ─────────────────────────────── Validation ───────────────────────────────

    public void validateScheme(AssessmentScheme scheme) {
        List<AssessmentComponent> comps = scheme.getComponents();
        if (comps.isEmpty()) throw new IllegalStateException("Scheme must have at least one component before publishing");
        BigDecimal total = comps.stream().map(AssessmentComponent::getWeightagePercent).reduce(BigDecimal.ZERO, BigDecimal::add);
        if (total.compareTo(new BigDecimal("100.00")) != 0) {
            throw new IllegalStateException("Total component weightage must equal 100% before publishing. Current total: " + total);
        }
        if (assignmentRepo.countByScheme_IdAndActiveTrue(scheme.getId()) == 0) {
            throw new IllegalStateException("Assign this scheme to at least one class, section, or subject before publishing.");
        }
        for (AssessmentSchemeAssignment a : scheme.getAssignments()) {
            if (!a.isActive()) continue;
            List<AssessmentSchemeAssignment> conflicts = assignmentRepo.findConflicts(
                    a.getSchool().getId(), a.getAcademicYear().getId(), a.getScopeType(),
                    a.getClassGroup() == null ? null : a.getClassGroup().getId(),
                    a.getSubject() == null ? null : a.getSubject().getId(),
                    scheme.getId());
            if (!conflicts.isEmpty()) throw new IllegalStateException("Assignment conflict found for " + a.getScopeType());
        }
    }

    private void validateComponentCreate(AssessmentScheme scheme, AssessmentComponentCreateDTO dto, Integer excludeComponentId) {
        for (AssessmentComponent c : scheme.getComponents()) {
            if (excludeComponentId != null && c.getId().equals(excludeComponentId)) continue;
            if (c.getName().equalsIgnoreCase(dto.name().trim())) throw new IllegalArgumentException("Component name '" + dto.name() + "' already exists in this scheme");
            if (c.getSequence().equals(dto.sequence())) throw new IllegalArgumentException("Sequence " + dto.sequence() + " is already used by component '" + c.getName() + "'");
        }
        if (dto.weightagePercent() == null || dto.weightagePercent().compareTo(BigDecimal.ZERO) <= 0) throw new IllegalArgumentException("Weightage percent must be greater than 0");
        if (dto.calculationRule() == CalculationRule.BEST_N_OF_M) {
            if (dto.totalAssessments() == null || dto.bestOfCount() == null) throw new IllegalArgumentException("BEST_N_OF_M requires totalAssessments and bestOfCount");
            if (dto.bestOfCount() > dto.totalAssessments()) throw new IllegalArgumentException("bestOfCount must be <= totalAssessments");
        }
        if (dto.calculationRule() != CalculationRule.ATTENDANCE_PERCENTAGE && dto.maxMarks() != null && dto.maxMarks().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("maxMarks must be greater than 0");
        }
    }

    private void mapComponentFields(AssessmentComponent comp, AssessmentComponentCreateDTO dto) {
        comp.setName(dto.name().trim());
        comp.setComponentType(dto.componentType());
        comp.setWeightagePercent(dto.weightagePercent());
        comp.setMaxMarks(dto.maxMarks());
        comp.setCalculationRule(dto.calculationRule());
        comp.setTotalAssessments(dto.totalAssessments());
        comp.setBestOfCount(dto.bestOfCount());
        comp.setSequence(dto.sequence());
        comp.setMandatory(dto.mandatory());
    }

    private AssessmentScheme requireDraftScheme(Integer schemeId) {
        Integer schoolId = requireSchoolId();
        AssessmentScheme scheme = schemeRepo.findByIdAndSchool_Id(schemeId, schoolId)
                .orElseThrow(() -> new NoSuchElementException("Assessment scheme not found"));
        if (scheme.getStatus() != AssessmentSchemeStatus.DRAFT) throw new IllegalStateException("Only DRAFT schemes can be modified. Current status: " + scheme.getStatus());
        return scheme;
    }

    private Integer requireSchoolId() {
        Integer schoolId = TenantContext.getTenantId();
        if (schoolId == null) throw new IllegalStateException("Missing school context");
        return schoolId;
    }

    private School requireSchool(Integer schoolId) {
        return schoolRepo.findById(schoolId).orElseThrow(() -> new NoSuchElementException("School not found"));
    }

    private AcademicYear requireAcademicYear(Integer id, Integer schoolId) {
        AcademicYear ay = academicYearRepo.findById(id).orElseThrow(() -> new NoSuchElementException("Academic year not found"));
        if (!ay.getSchool().getId().equals(schoolId)) throw new IllegalArgumentException("Academic year does not belong to this school");
        return ay;
    }

    private ClassGroup requireClassGroup(Integer id, Integer schoolId) {
        ClassGroup cg = classGroupRepo.findById(id).orElseThrow(() -> new NoSuchElementException("Class group not found"));
        if (!Objects.equals(cg.getSchool().getId(), schoolId) || cg.isDeleted()) throw new IllegalArgumentException("Class group does not belong to this school");
        return cg;
    }

    private Subject requireSubject(Integer id, Integer schoolId) {
        Subject subject = subjectRepo.findById(id).orElseThrow(() -> new NoSuchElementException("Subject not found"));
        if (!Objects.equals(subject.getSchool().getId(), schoolId) || subject.isDeleted()) throw new IllegalArgumentException("Subject does not belong to this school");
        return subject;
    }

    // ─────────────────────────────── Mappers ──────────────────────────────────

    private AssessmentSchemeDTO toDTO(AssessmentScheme s) {
        List<AssessmentComponentDTO> components = s.getComponents().stream().map(this::toComponentDTO).toList();
        List<AssessmentSchemeAssignmentDTO> assignments = s.getAssignments().stream().map(this::toAssignmentDTO).toList();
        String ayLabel = s.getAcademicYear() != null ? s.getAcademicYear().getLabel() : null;
        Integer ayId = s.getAcademicYear() != null ? s.getAcademicYear().getId() : null;
        Summary summary = summarizeAssignments(s.getAssignments());
        return new AssessmentSchemeDTO(
                s.getId(), s.getSchool().getId(), ayId, ayLabel, s.getName(), s.getDescription(), s.getStatus(),
                s.getVersionNo(), s.getPublishedAt(), s.getArchivedAt(), s.getCreatedAt(), s.getUpdatedAt(),
                summary.classCount(), summary.subjectCount(), summary.label(), assignments, components
        );
    }

    private AssessmentSchemeAssignmentDTO toAssignmentDTO(AssessmentSchemeAssignment a) {
        ClassGroup cg = a.getClassGroup();
        Subject subject = a.getSubject();
        return new AssessmentSchemeAssignmentDTO(
                a.getId(), a.getSchool().getId(), a.getScheme().getId(), a.getAcademicYear().getId(), a.getScopeType(),
                cg == null ? null : cg.getId(), cg == null ? null : classLabel(cg), cg == null ? null : cg.getGradeLevel(),
                subject == null ? null : subject.getId(), subject == null ? null : subject.getName(), subject == null ? null : subject.getCode(),
                a.isActive(), a.getCreatedAt(), a.getUpdatedAt()
        );
    }

    private record Summary(int classCount, int subjectCount, String label) {}

    private Summary summarizeAssignments(List<AssessmentSchemeAssignment> assignments) {
        List<AssessmentSchemeAssignment> active = assignments.stream().filter(AssessmentSchemeAssignment::isActive).toList();
        if (active.isEmpty()) return new Summary(0, 0, "Not assigned");
        if (active.stream().anyMatch(a -> a.getScopeType() == ExamApplicableScopeType.SCHOOL)) return new Summary(0, 0, "School-wide");
        Set<Integer> classes = active.stream().map(AssessmentSchemeAssignment::getClassGroup).filter(Objects::nonNull).map(ClassGroup::getId).collect(Collectors.toCollection(LinkedHashSet::new));
        Set<Integer> subjects = active.stream().map(AssessmentSchemeAssignment::getSubject).filter(Objects::nonNull).map(Subject::getId).collect(Collectors.toCollection(LinkedHashSet::new));
        long subjectOverrides = active.stream().filter(a -> a.getScopeType() == ExamApplicableScopeType.SUBJECT || a.getScopeType() == ExamApplicableScopeType.CLASS_SUBJECT || a.getScopeType() == ExamApplicableScopeType.SECTION_SUBJECT).count();
        String label;
        if (classes.size() == 1 && subjects.isEmpty()) label = classLabel(active.stream().map(AssessmentSchemeAssignment::getClassGroup).filter(Objects::nonNull).findFirst().orElseThrow());
        else if (classes.size() > 1 && subjectOverrides == 0) label = gradeRangeLabel(active);
        else if (classes.isEmpty() && subjects.size() == 1) label = active.stream().map(AssessmentSchemeAssignment::getSubject).filter(Objects::nonNull).findFirst().map(Subject::getName).orElse("1 subject");
        else label = classes.size() + " classes" + (subjectOverrides > 0 ? ", " + subjectOverrides + " subject override" + (subjectOverrides == 1 ? "" : "s") : "");
        return new Summary(classes.size(), subjects.size(), label);
    }

    private String gradeRangeLabel(List<AssessmentSchemeAssignment> assignments) {
        List<Integer> grades = assignments.stream().map(AssessmentSchemeAssignment::getClassGroup).filter(Objects::nonNull).map(ClassGroup::getGradeLevel).filter(Objects::nonNull).distinct().sorted().toList();
        if (grades.isEmpty()) return assignments.size() + " classes";
        if (grades.size() == 1) return "Grade " + grades.get(0);
        boolean contiguous = true;
        for (int i = 1; i < grades.size(); i++) if (grades.get(i) != grades.get(i - 1) + 1) contiguous = false;
        return contiguous ? "Grades " + grades.get(0) + "–" + grades.get(grades.size() - 1) : "Grades " + grades.stream().map(String::valueOf).collect(Collectors.joining(", "));
    }

    private String classLabel(ClassGroup cg) {
        return cg.getDisplayName() != null && !cg.getDisplayName().isBlank() ? cg.getDisplayName() : cg.getCode();
    }

    private boolean looksLikeBadMultiSchemeDraft(String name) {
        return name != null && name.matches(".*\\[(Grade|Class|Section|Subject) [^]]+].*");
    }

    private AssessmentComponentDTO toComponentDTO(AssessmentComponent c) {
        return new AssessmentComponentDTO(
                c.getId(), c.getScheme().getId(), c.getName(), c.getComponentType(), c.getWeightagePercent(), c.getMaxMarks(),
                c.getCalculationRule(), c.getTotalAssessments(), c.getBestOfCount(), c.getSequence(), c.isMandatory(), c.getCreatedAt(), c.getUpdatedAt()
        );
    }

    private GradingSchemeDTO toGradingDTO(GradingScheme gs) {
        List<GradingBandDTO> bands = gs.getBands().stream()
                .map(b -> new GradingBandDTO(b.getId(), b.getGrade(), b.getMinPercent(), b.getMaxPercent(), b.getGradePoint(), b.getRemarks(), b.getSequence()))
                .toList();
        Integer ayId = gs.getAcademicYear() != null ? gs.getAcademicYear().getId() : null;
        return new GradingSchemeDTO(gs.getId(), gs.getSchool().getId(), ayId, gs.getName(), gs.isActive(), gs.getCreatedAt(), gs.getUpdatedAt(), bands);
    }
}

