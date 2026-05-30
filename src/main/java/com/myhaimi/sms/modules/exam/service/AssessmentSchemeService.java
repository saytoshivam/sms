package com.myhaimi.sms.modules.exam.service;

import com.myhaimi.sms.entity.AcademicYear;
import com.myhaimi.sms.entity.School;
import com.myhaimi.sms.modules.exam.dto.*;
import com.myhaimi.sms.modules.exam.entity.AssessmentComponent;
import com.myhaimi.sms.modules.exam.entity.AssessmentScheme;
import com.myhaimi.sms.modules.exam.entity.GradingBand;
import com.myhaimi.sms.modules.exam.entity.GradingScheme;
import com.myhaimi.sms.modules.exam.entity.enums.AssessmentSchemeStatus;
import com.myhaimi.sms.modules.exam.entity.enums.CalculationRule;
import com.myhaimi.sms.modules.exam.repository.AssessmentComponentRepository;
import com.myhaimi.sms.modules.exam.repository.AssessmentSchemeRepository;
import com.myhaimi.sms.modules.exam.repository.GradingBandRepository;
import com.myhaimi.sms.modules.exam.repository.GradingSchemeRepository;
import com.myhaimi.sms.repository.AcademicYearRepo;
import com.myhaimi.sms.repository.SchoolRepo;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.NoSuchElementException;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AssessmentSchemeService {

    private final AssessmentSchemeRepository schemeRepo;
    private final AssessmentComponentRepository componentRepo;
    private final GradingSchemeRepository gradingSchemeRepo;
    private final GradingBandRepository gradingBandRepo;
    private final SchoolRepo schoolRepo;
    private final AcademicYearRepo academicYearRepo;

    // ─────────────────────────────── Scheme CRUD ──────────────────────────────

    @Transactional
    public AssessmentSchemeDTO createScheme(AssessmentSchemeCreateDTO dto) {
        Integer schoolId = requireSchoolId();
        School school = schoolRepo.findById(schoolId)
                .orElseThrow(() -> new NoSuchElementException("School not found"));
        AcademicYear ay = academicYearRepo.findById(dto.academicYearId())
                .orElseThrow(() -> new NoSuchElementException("Academic year not found"));
        if (!ay.getSchool().getId().equals(schoolId)) {
            throw new IllegalArgumentException("Academic year does not belong to this school");
        }

        AssessmentScheme scheme = new AssessmentScheme();
        scheme.setSchool(school);
        scheme.setAcademicYear(ay);
        scheme.setName(dto.name().trim());
        scheme.setDescription(dto.description());
        scheme.setApplicableScopeType(dto.applicableScopeType());
        scheme.setApplicableScopeId(dto.applicableScopeId());
        scheme.setStatus(AssessmentSchemeStatus.DRAFT);
        scheme.setVersionNo(1);

        return toDTO(schemeRepo.save(scheme));
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
                .map(this::toDTO)
                .toList();
    }

    public AssessmentSchemeDTO getScheme(Integer schemeId) {
        Integer schoolId = requireSchoolId();
        AssessmentScheme scheme = schemeRepo.findByIdAndSchool_Id(schemeId, schoolId)
                .orElseThrow(() -> new NoSuchElementException("Assessment scheme not found"));
        return toDTO(scheme);
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

    // ──────────���──────────────────── Lifecycle ────────────────────────────────

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
        if (scheme.getStatus() == AssessmentSchemeStatus.ARCHIVED) {
            throw new IllegalStateException("Scheme is already archived");
        }
        scheme.setStatus(AssessmentSchemeStatus.ARCHIVED);
        scheme.setArchivedAt(Instant.now());
        return toDTO(schemeRepo.save(scheme));
    }

    @Transactional
    public AssessmentSchemeDTO cloneScheme(Integer schemeId) {
        Integer schoolId = requireSchoolId();
        AssessmentScheme source = schemeRepo.findByIdAndSchool_Id(schemeId, schoolId)
                .orElseThrow(() -> new NoSuchElementException("Assessment scheme not found"));
        if (source.getStatus() != AssessmentSchemeStatus.PUBLISHED) {
            throw new IllegalStateException("Only PUBLISHED schemes can be cloned");
        }

        AssessmentScheme clone = new AssessmentScheme();
        clone.setSchool(source.getSchool());
        clone.setAcademicYear(source.getAcademicYear());
        clone.setName(source.getName() + " (Copy)");
        clone.setDescription(source.getDescription());
        clone.setApplicableScopeType(source.getApplicableScopeType());
        clone.setApplicableScopeId(source.getApplicableScopeId());
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
        return gradingSchemeRepo.findBySchool_IdOrderByCreatedAtAsc(schoolId).stream()
                .map(this::toGradingDTO)
                .toList();
    }

    @Transactional
    public GradingSchemeDTO createGradingScheme(GradingSchemeCreateDTO dto) {
        Integer schoolId = requireSchoolId();
        School school = schoolRepo.findById(schoolId)
                .orElseThrow(() -> new NoSuchElementException("School not found"));

        AcademicYear ay = null;
        if (dto.academicYearId() != null) {
            ay = academicYearRepo.findById(dto.academicYearId())
                    .orElseThrow(() -> new NoSuchElementException("Academic year not found"));
            if (!ay.getSchool().getId().equals(schoolId)) {
                throw new IllegalArgumentException("Academic year does not belong to this school");
            }
        }

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
            band.setSequence(b.sequence() != null ? b.sequence() : seq);
            gradingBandRepo.save(band);
            seq++;
        }

        return toGradingDTO(gradingSchemeRepo.findById(gs.getId()).orElseThrow());
    }

    // ─────────────────────────────── Validation ───────────────────────────────

    public void validateScheme(AssessmentScheme scheme) {
        List<AssessmentComponent> comps = scheme.getComponents();
        if (comps.isEmpty()) {
            throw new IllegalStateException("Scheme must have at least one component before publishing");
        }

        BigDecimal total = comps.stream()
                .map(AssessmentComponent::getWeightagePercent)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (total.compareTo(new BigDecimal("100.00")) != 0) {
            throw new IllegalStateException(
                    "Total component weightage must equal 100% before publishing. Current total: " + total);
        }
    }

    // ─────────────────────────────── Helpers ──────────────────────────────────

    private void validateComponentCreate(AssessmentScheme scheme, AssessmentComponentCreateDTO dto,
                                          Integer excludeComponentId) {
        // Duplicate name check
        List<AssessmentComponent> existing = scheme.getComponents();
        for (AssessmentComponent c : existing) {
            if (excludeComponentId != null && c.getId().equals(excludeComponentId)) continue;
            if (c.getName().equalsIgnoreCase(dto.name().trim())) {
                throw new IllegalArgumentException("Component name '" + dto.name() + "' already exists in this scheme");
            }
            if (c.getSequence().equals(dto.sequence())) {
                throw new IllegalArgumentException("Sequence " + dto.sequence() + " is already used by component '" + c.getName() + "'");
            }
        }

        if (dto.weightagePercent() == null || dto.weightagePercent().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Weightage percent must be greater than 0");
        }

        if (dto.calculationRule() == CalculationRule.BEST_N_OF_M) {
            if (dto.totalAssessments() == null || dto.bestOfCount() == null) {
                throw new IllegalArgumentException("BEST_N_OF_M requires totalAssessments and bestOfCount");
            }
            if (dto.bestOfCount() > dto.totalAssessments()) {
                throw new IllegalArgumentException("bestOfCount must be <= totalAssessments");
            }
        }

        if (dto.calculationRule() != CalculationRule.ATTENDANCE_PERCENTAGE) {
            if (dto.maxMarks() != null && dto.maxMarks().compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalArgumentException("maxMarks must be greater than 0");
            }
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
        if (scheme.getStatus() != AssessmentSchemeStatus.DRAFT) {
            throw new IllegalStateException("Only DRAFT schemes can be modified. Current status: " + scheme.getStatus());
        }
        return scheme;
    }

    private Integer requireSchoolId() {
        Integer schoolId = TenantContext.getTenantId();
        if (schoolId == null) throw new IllegalStateException("Missing school context");
        return schoolId;
    }

    // ─────────────────────────────── Mappers ──────────────────────────────────

    private AssessmentSchemeDTO toDTO(AssessmentScheme s) {
        List<AssessmentComponentDTO> components = s.getComponents().stream()
                .map(this::toComponentDTO)
                .toList();
        String ayLabel = s.getAcademicYear() != null ? s.getAcademicYear().getLabel() : null;
        Integer ayId = s.getAcademicYear() != null ? s.getAcademicYear().getId() : null;
        return new AssessmentSchemeDTO(
                s.getId(),
                s.getSchool().getId(),
                ayId,
                ayLabel,
                s.getName(),
                s.getDescription(),
                s.getApplicableScopeType(),
                s.getApplicableScopeId(),
                s.getStatus(),
                s.getVersionNo(),
                s.getPublishedAt(),
                s.getArchivedAt(),
                s.getCreatedAt(),
                s.getUpdatedAt(),
                components
        );
    }

    private AssessmentComponentDTO toComponentDTO(AssessmentComponent c) {
        return new AssessmentComponentDTO(
                c.getId(),
                c.getScheme().getId(),
                c.getName(),
                c.getComponentType(),
                c.getWeightagePercent(),
                c.getMaxMarks(),
                c.getCalculationRule(),
                c.getTotalAssessments(),
                c.getBestOfCount(),
                c.getSequence(),
                c.isMandatory(),
                c.getCreatedAt(),
                c.getUpdatedAt()
        );
    }

    private GradingSchemeDTO toGradingDTO(GradingScheme gs) {
        List<GradingBandDTO> bands = gs.getBands().stream()
                .map(b -> new GradingBandDTO(b.getId(), b.getGrade(), b.getMinPercent(), b.getMaxPercent(),
                        b.getGradePoint(), b.getRemarks(), b.getSequence()))
                .toList();
        Integer ayId = gs.getAcademicYear() != null ? gs.getAcademicYear().getId() : null;
        return new GradingSchemeDTO(gs.getId(), gs.getSchool().getId(), ayId, gs.getName(), gs.isActive(),
                gs.getCreatedAt(), gs.getUpdatedAt(), bands);
    }
}

