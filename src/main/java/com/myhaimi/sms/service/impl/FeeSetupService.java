package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.fee.*;
import com.myhaimi.sms.entity.*;
import com.myhaimi.sms.entity.enums.ApplicableScopeType;
import com.myhaimi.sms.entity.enums.FeePlanStatus;
import com.myhaimi.sms.repository.*;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

/**
 * Core fee setup service: manages fee heads, fee plans, plan items and installments.
 *
 * <p>Business rules enforced here:
 * <ul>
 *   <li>No duplicate fee head code per school.</li>
 *   <li>Inactive fee heads cannot be added to plan items.</li>
 *   <li>Fee heads with existing demands cannot be deactivated.</li>
 *   <li>PUBLISHED / ARCHIVED plans are read-only — items cannot be added/edited/removed.</li>
 *   <li>A plan cannot be published without at least one item and at least one installment
 *       per item.</li>
 *   <li>Scope IDs are validated against the current school tenant.</li>
 * </ul>
 * </p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FeeSetupService {

    private final FeeHeadRepository feeHeadRepository;
    private final FeePlanRepository feePlanRepository;
    private final FeePlanItemRepository feePlanItemRepository;
    private final FeeInstallmentRepository feeInstallmentRepository;
    private final StudentFeeDemandRepository studentFeeDemandRepository;
    private final SchoolRepo schoolRepo;
    private final AcademicYearRepo academicYearRepo;
    private final ClassGroupRepo classGroupRepo;
    private final StudentRepo studentRepo;

    // ─── helpers ─────────────────────────────────────────────────────────────

    private Integer requireSchoolId() {
        Integer schoolId = TenantContext.getTenantId();
        if (schoolId == null) throw new IllegalStateException("Missing school context");
        return schoolId;
    }

    private School requireSchool(Integer schoolId) {
        return schoolRepo.findById(schoolId)
                .orElseThrow(() -> new IllegalStateException("School not found: " + schoolId));
    }

    // ─── Fee Head ─────────────────────────────────────────────────────────────

    @Transactional
    public FeeHeadDTO createFeeHead(FeeHeadCreateDTO dto) {
        Integer schoolId = requireSchoolId();
        School school = requireSchool(schoolId);

        if (feeHeadRepository.existsBySchool_IdAndCode(schoolId, dto.getCode().trim().toUpperCase())) {
            throw new IllegalArgumentException("Fee head code '" + dto.getCode() + "' already exists in this school");
        }

        FeeHead head = new FeeHead();
        head.setSchool(school);
        head.setCode(dto.getCode().trim().toUpperCase());
        head.setName(dto.getName().trim());
        head.setDescription(dto.getDescription());
        head.setFeeType(dto.getFeeType());
        head.setRefundable(dto.isRefundable());
        head.setOptional(dto.isOptional());
        head.setActive(true);

        return toFeeHeadDTO(feeHeadRepository.save(head));
    }

    @Transactional
    public FeeHeadDTO updateFeeHead(Integer id, FeeHeadCreateDTO dto) {
        Integer schoolId = requireSchoolId();
        FeeHead head = feeHeadRepository.findByIdAndSchool_Id(id, schoolId)
                .orElseThrow(() -> new IllegalArgumentException("Fee head not found: " + id));

        String newCode = dto.getCode().trim().toUpperCase();
        if (!newCode.equals(head.getCode()) &&
                feeHeadRepository.existsBySchool_IdAndCodeAndIdNot(schoolId, newCode, id)) {
            throw new IllegalArgumentException("Fee head code '" + newCode + "' already exists in this school");
        }

        head.setCode(newCode);
        head.setName(dto.getName().trim());
        head.setDescription(dto.getDescription());
        head.setFeeType(dto.getFeeType());
        head.setRefundable(dto.isRefundable());
        head.setOptional(dto.isOptional());

        return toFeeHeadDTO(feeHeadRepository.save(head));
    }

    public Page<FeeHeadDTO> listFeeHeads(Pageable pageable) {
        Integer schoolId = requireSchoolId();
        return feeHeadRepository.findBySchool_IdOrderByNameAsc(schoolId, pageable)
                .map(this::toFeeHeadDTO);
    }

    @Transactional
    public FeeHeadDTO deactivateFeeHead(Integer id) {
        Integer schoolId = requireSchoolId();
        FeeHead head = feeHeadRepository.findByIdAndSchool_Id(id, schoolId)
                .orElseThrow(() -> new IllegalArgumentException("Fee head not found: " + id));

        // Guard: cannot deactivate a fee head that already has demand records
        if (studentFeeDemandRepository.existsBySchool_IdAndFeeHead_Id(schoolId, id)) {
            throw new IllegalStateException(
                    "Fee head '" + head.getName() + "' has student demand records and cannot be deactivated. "
                    + "Archive the associated fee plan instead.");
        }

        head.setActive(false);
        log.info("[AUDIT] fee_head.deactivated schoolId={} feeHeadId={} code={}", schoolId, id, head.getCode());
        return toFeeHeadDTO(feeHeadRepository.save(head));
    }

    // ─── Fee Plan ─────────────────────────────────────────────────────────────

    @Transactional
    public FeePlanDTO createFeePlan(FeePlanCreateDTO dto) {
        Integer schoolId = requireSchoolId();
        School school = requireSchool(schoolId);

        AcademicYear academicYear = academicYearRepo.findByIdAndSchool_Id(dto.getAcademicYearId(), schoolId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Academic year not found or does not belong to this school: " + dto.getAcademicYearId()));

        FeePlan plan = new FeePlan();
        plan.setSchool(school);
        plan.setAcademicYear(academicYear);
        plan.setName(dto.getName().trim());
        plan.setDescription(dto.getDescription());
        plan.setStatus(FeePlanStatus.DRAFT);

        return toFeePlanDTO(feePlanRepository.save(plan));
    }

    @Transactional
    public FeePlanDTO updateFeePlan(Integer id, FeePlanCreateDTO dto) {
        Integer schoolId = requireSchoolId();
        FeePlan plan = requireEditablePlan(id, schoolId);

        AcademicYear academicYear = academicYearRepo.findByIdAndSchool_Id(dto.getAcademicYearId(), schoolId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Academic year not found or does not belong to this school: " + dto.getAcademicYearId()));

        plan.setAcademicYear(academicYear);
        plan.setName(dto.getName().trim());
        plan.setDescription(dto.getDescription());

        return toFeePlanDTO(feePlanRepository.save(plan));
    }

    public Page<FeePlanDTO> listFeePlans(Pageable pageable) {
        Integer schoolId = requireSchoolId();
        return feePlanRepository.findBySchool_IdOrderByCreatedAtDesc(schoolId, pageable)
                .map(this::toFeePlanDTO);
    }

    public FeePlanDetailDTO getFeePlanDetails(Integer id) {
        Integer schoolId = requireSchoolId();
        FeePlan plan = feePlanRepository.findByIdAndSchool_Id(id, schoolId)
                .orElseThrow(() -> new IllegalArgumentException("Fee plan not found: " + id));

        List<FeePlanItem> items = feePlanItemRepository.findByFeePlan_IdOrderByIdAsc(id);
        List<FeePlanItemDTO> itemDTOs = items.stream()
                .map(item -> {
                    FeePlanItemDTO dto = toFeePlanItemDTO(item);
                    List<FeeInstallment> installments =
                            feeInstallmentRepository.findByFeePlanItem_IdOrderBySequenceAsc(item.getId());
                    dto.setInstallments(installments.stream()
                            .map(this::toFeeInstallmentDTO)
                            .collect(Collectors.toList()));
                    return dto;
                })
                .collect(Collectors.toList());

        FeePlanDetailDTO detail = new FeePlanDetailDTO();
        detail.setPlan(toFeePlanDTO(plan));
        detail.setItems(itemDTOs);
        return detail;
    }

    @Transactional
    public FeePlanDTO publishFeePlan(Integer id) {
        Integer schoolId = requireSchoolId();
        FeePlan plan = requireEditablePlan(id, schoolId);

        // Must have at least one item
        if (!feePlanItemRepository.existsByFeePlan_Id(id)) {
            throw new IllegalStateException("Cannot publish fee plan without at least one fee item");
        }

        // Every item must have at least one installment
        List<FeePlanItem> items = feePlanItemRepository.findByFeePlan_IdOrderByIdAsc(id);
        for (FeePlanItem item : items) {
            List<FeeInstallment> installments =
                    feeInstallmentRepository.findByFeePlanItem_IdOrderBySequenceAsc(item.getId());
            if (installments.isEmpty()) {
                throw new IllegalStateException(
                        "Fee plan item '" + item.getFeeHead().getName() + "' has no installments. "
                        + "Add at least one installment before publishing.");
            }
        }

        plan.setStatus(FeePlanStatus.PUBLISHED);
        plan.setPublishedAt(Instant.now());
        FeePlanDTO result = toFeePlanDTO(feePlanRepository.save(plan));
        // TODO: audit(fee_plan.published, schoolId, planId, publishedByUserId)
        log.info("[AUDIT] fee_plan.published schoolId={} planId={} planName='{}'",
                plan.getSchool().getId(), plan.getId(), plan.getName());
        return result;
    }

    @Transactional
    public FeePlanDTO archiveFeePlan(Integer id) {
        Integer schoolId = requireSchoolId();
        FeePlan plan = feePlanRepository.findByIdAndSchool_Id(id, schoolId)
                .orElseThrow(() -> new IllegalArgumentException("Fee plan not found: " + id));

        if (plan.getStatus() == FeePlanStatus.ARCHIVED) {
            throw new IllegalStateException("Fee plan is already archived");
        }

        plan.setStatus(FeePlanStatus.ARCHIVED);
        return toFeePlanDTO(feePlanRepository.save(plan));
    }

    // ─── Fee Plan Items ───────────────────────────────────────────────────────

    @Transactional
    public FeePlanItemDTO addFeePlanItem(Integer planId, FeePlanItemCreateDTO dto) {
        Integer schoolId = requireSchoolId();
        FeePlan plan = requireEditablePlan(planId, schoolId);

        FeeHead feeHead = feeHeadRepository.findByIdAndSchool_Id(dto.getFeeHeadId(), schoolId)
                .orElseThrow(() -> new IllegalArgumentException("Fee head not found: " + dto.getFeeHeadId()));

        if (!feeHead.isActive()) {
            throw new IllegalArgumentException("Cannot add inactive fee head '" + feeHead.getName() + "' to plan");
        }

        validateScope(dto.getApplicableScopeType(), dto.getApplicableScopeId(), schoolId);

        FeePlanItem item = new FeePlanItem();
        item.setFeePlan(plan);
        item.setFeeHead(feeHead);
        item.setApplicableScopeType(dto.getApplicableScopeType());
        item.setApplicableScopeId(dto.getApplicableScopeId());
        item.setAmount(dto.getAmount());
        item.setFrequency(dto.getFrequency());
        item.setMandatory(dto.isMandatory());

        FeePlanItemDTO result = toFeePlanItemDTO(feePlanItemRepository.save(item));
        result.setInstallments(List.of());
        return result;
    }

    @Transactional
    public FeePlanItemDTO updateFeePlanItem(Integer planId, Integer itemId, FeePlanItemCreateDTO dto) {
        Integer schoolId = requireSchoolId();
        requireEditablePlan(planId, schoolId);

        FeePlanItem item = feePlanItemRepository.findByIdAndFeePlan_Id(itemId, planId)
                .orElseThrow(() -> new IllegalArgumentException("Fee plan item not found: " + itemId));

        FeeHead feeHead = feeHeadRepository.findByIdAndSchool_Id(dto.getFeeHeadId(), schoolId)
                .orElseThrow(() -> new IllegalArgumentException("Fee head not found: " + dto.getFeeHeadId()));

        if (!feeHead.isActive()) {
            throw new IllegalArgumentException("Cannot assign inactive fee head '" + feeHead.getName() + "'");
        }

        validateScope(dto.getApplicableScopeType(), dto.getApplicableScopeId(), schoolId);

        item.setFeeHead(feeHead);
        item.setApplicableScopeType(dto.getApplicableScopeType());
        item.setApplicableScopeId(dto.getApplicableScopeId());
        item.setAmount(dto.getAmount());
        item.setFrequency(dto.getFrequency());
        item.setMandatory(dto.isMandatory());

        FeePlanItemDTO result = toFeePlanItemDTO(feePlanItemRepository.save(item));
        List<FeeInstallment> installments =
                feeInstallmentRepository.findByFeePlanItem_IdOrderBySequenceAsc(itemId);
        result.setInstallments(installments.stream().map(this::toFeeInstallmentDTO).collect(Collectors.toList()));
        return result;
    }

    @Transactional
    public void deleteFeePlanItem(Integer planId, Integer itemId) {
        Integer schoolId = requireSchoolId();
        requireEditablePlan(planId, schoolId);

        FeePlanItem item = feePlanItemRepository.findByIdAndFeePlan_Id(itemId, planId)
                .orElseThrow(() -> new IllegalArgumentException("Fee plan item not found: " + itemId));

        // Cascade deletes installments via FK ON DELETE CASCADE
        feePlanItemRepository.delete(item);
    }

    // ─── Installments ─────────────────────────────────────────────────────────

    @Transactional
    public List<FeeInstallmentDTO> addInstallments(Integer planId, Integer itemId,
                                                    FeeInstallmentCreateDTO dto) {
        Integer schoolId = requireSchoolId();
        requireEditablePlan(planId, schoolId);

        FeePlanItem item = feePlanItemRepository.findByIdAndFeePlan_Id(itemId, planId)
                .orElseThrow(() -> new IllegalArgumentException("Fee plan item not found: " + itemId));

        // Replace existing installments
        feeInstallmentRepository.deleteByFeePlanItem_Id(itemId);

        List<FeeInstallmentCreateDTO.InstallmentEntry> entries = dto.getInstallments();

        // Validate total matches item amount
        BigDecimal total = entries.stream()
                .map(FeeInstallmentCreateDTO.InstallmentEntry::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (total.compareTo(item.getAmount()) != 0) {
            throw new IllegalArgumentException(
                    String.format("Installment total (%s) must equal fee plan item amount (%s)",
                            total, item.getAmount()));
        }

        List<FeeInstallment> saved = IntStream.range(0, entries.size())
                .mapToObj(idx -> {
                    FeeInstallmentCreateDTO.InstallmentEntry entry = entries.get(idx);
                    FeeInstallment inst = new FeeInstallment();
                    inst.setFeePlanItem(item);
                    inst.setName(entry.getName().trim());
                    inst.setDueDate(entry.getDueDate());
                    inst.setAmount(entry.getAmount());
                    inst.setSequence(entry.getSequence() != null ? entry.getSequence() : idx + 1);
                    return feeInstallmentRepository.save(inst);
                })
                .collect(Collectors.toList());

        return saved.stream().map(this::toFeeInstallmentDTO).collect(Collectors.toList());
    }

    // ─── Validation helpers ───────────────────────────────────────────────────

    /**
     * Guards against editing PUBLISHED or ARCHIVED plans.
     */
    private FeePlan requireEditablePlan(Integer planId, Integer schoolId) {
        FeePlan plan = feePlanRepository.findByIdAndSchool_Id(planId, schoolId)
                .orElseThrow(() -> new IllegalArgumentException("Fee plan not found: " + planId));
        if (plan.getStatus() != FeePlanStatus.DRAFT) {
            throw new IllegalStateException(
                    "Fee plan '" + plan.getName() + "' is " + plan.getStatus()
                    + " and cannot be edited. Archive it and create a new plan.");
        }
        return plan;
    }

    /**
     * Validates that the applicableScopeId belongs to the current school tenant.
     */
    private void validateScope(ApplicableScopeType scopeType, Integer scopeId, Integer schoolId) {
        switch (scopeType) {
            case SCHOOL -> {
                if (!schoolId.equals(scopeId)) {
                    throw new IllegalArgumentException("Scope school ID does not match current school");
                }
            }
            case CLASS, SECTION -> {
                if (classGroupRepo.findByIdAndSchool_Id(scopeId, schoolId).isEmpty()) {
                    throw new IllegalArgumentException(
                            "Class/section not found or does not belong to this school: " + scopeId);
                }
            }
            case STUDENT -> {
                if (studentRepo.findByIdAndSchool_Id(scopeId, schoolId).isEmpty()) {
                    throw new IllegalArgumentException(
                            "Student not found or does not belong to this school: " + scopeId);
                }
            }
        }
    }

    // ─── Mappers ──────────────────────────────────────────────────────────────

    private FeeHeadDTO toFeeHeadDTO(FeeHead h) {
        FeeHeadDTO dto = new FeeHeadDTO();
        dto.setId(h.getId());
        dto.setSchoolId(h.getSchool().getId());
        dto.setCode(h.getCode());
        dto.setName(h.getName());
        dto.setDescription(h.getDescription());
        dto.setFeeType(h.getFeeType());
        dto.setRefundable(h.isRefundable());
        dto.setOptional(h.isOptional());
        dto.setActive(h.isActive());
        dto.setCreatedAt(h.getCreatedAt());
        dto.setUpdatedAt(h.getUpdatedAt());
        return dto;
    }

    private FeePlanDTO toFeePlanDTO(FeePlan p) {
        FeePlanDTO dto = new FeePlanDTO();
        dto.setId(p.getId());
        dto.setSchoolId(p.getSchool().getId());
        dto.setAcademicYearId(p.getAcademicYear().getId());
        dto.setAcademicYearLabel(p.getAcademicYear().getLabel());
        dto.setName(p.getName());
        dto.setDescription(p.getDescription());
        dto.setStatus(p.getStatus());
        dto.setPublishedAt(p.getPublishedAt());
        dto.setCreatedAt(p.getCreatedAt());
        dto.setUpdatedAt(p.getUpdatedAt());
        return dto;
    }

    private FeePlanItemDTO toFeePlanItemDTO(FeePlanItem i) {
        FeePlanItemDTO dto = new FeePlanItemDTO();
        dto.setId(i.getId());
        dto.setFeePlanId(i.getFeePlan().getId());
        dto.setFeeHeadId(i.getFeeHead().getId());
        dto.setFeeHeadCode(i.getFeeHead().getCode());
        dto.setFeeHeadName(i.getFeeHead().getName());
        dto.setApplicableScopeType(i.getApplicableScopeType());
        dto.setApplicableScopeId(i.getApplicableScopeId());
        dto.setAmount(i.getAmount());
        dto.setFrequency(i.getFrequency());
        dto.setMandatory(i.isMandatory());
        dto.setCreatedAt(i.getCreatedAt());
        dto.setUpdatedAt(i.getUpdatedAt());
        return dto;
    }

    private FeeInstallmentDTO toFeeInstallmentDTO(FeeInstallment fi) {
        FeeInstallmentDTO dto = new FeeInstallmentDTO();
        dto.setId(fi.getId());
        dto.setFeePlanItemId(fi.getFeePlanItem().getId());
        dto.setName(fi.getName());
        dto.setDueDate(fi.getDueDate());
        dto.setAmount(fi.getAmount());
        dto.setSequence(fi.getSequence());
        dto.setCreatedAt(fi.getCreatedAt());
        dto.setUpdatedAt(fi.getUpdatedAt());
        return dto;
    }
}

