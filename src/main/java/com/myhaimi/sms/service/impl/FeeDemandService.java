package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.fee.DemandGenerationResultDTO;
import com.myhaimi.sms.DTO.fee.StudentFeeDemandDTO;
import com.myhaimi.sms.entity.*;
import com.myhaimi.sms.entity.enums.ApplicableScopeType;
import com.myhaimi.sms.entity.enums.FeePlanStatus;
import com.myhaimi.sms.entity.enums.StudentFeeDemandStatus;
import com.myhaimi.sms.repository.*;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Generates and queries {@link StudentFeeDemand} records from a published
 * {@link FeePlan}.
 *
 * <p><strong>Generation invariant:</strong> one demand per
 * (student, feePlanItem, installment).  Re-running generation for the same
 * plan is safe — existing demands are counted as "skipped" and no duplicate
 * is created.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FeeDemandService {

    private final FeePlanRepository feePlanRepository;
    private final FeePlanItemRepository feePlanItemRepository;
    private final FeeInstallmentRepository feeInstallmentRepository;
    private final StudentFeeDemandRepository demandRepository;
    private final StudentAcademicEnrollmentRepo enrollmentRepo;
    private final ClassGroupRepo classGroupRepo;
    private final SchoolRepo schoolRepo;

    // ─── helpers ──────────────────────────────────────────────────────────────

    private Integer requireSchoolId() {
        Integer id = TenantContext.getTenantId();
        if (id == null) throw new IllegalStateException("Missing school context");
        return id;
    }

    /**
     * Zero-padded school-scoped demand number: {@code {schoolCode}-{year}-{seq:06d}}.
     * The sequence is fetched and incremented inside the same transaction so
     * concurrent generations will not produce duplicates (DB unique constraint
     * is the ultimate safety net).
     */
    private String buildDemandNo(School school, AcademicYear academicYear, long seq) {
        String yearTag = String.valueOf(academicYear.getLabel()).replaceAll("[^0-9A-Za-z]", "").substring(0, Math.min(8, academicYear.getLabel().length()));
        return String.format("%s-%s-%06d", school.getCode().toUpperCase(), yearTag, seq);
    }

    // ─── Scope resolution ─────────────────────────────────────────────────────

    /**
     * Returns the distinct set of students applicable to a given
     * {@link FeePlanItem} for the supplied academic year.
     */
    private List<Student> resolveStudents(FeePlanItem item, Integer schoolId,
                                          Integer academicYearId, List<String> warnings) {
        ApplicableScopeType scope = item.getApplicableScopeType();
        Integer scopeId = item.getApplicableScopeId();

        return switch (scope) {
            case SCHOOL -> {
                List<StudentAcademicEnrollment> enrollments =
                        enrollmentRepo.findActiveEnrollmentsBySchoolAndYear(schoolId, academicYearId);
                yield enrollments.stream()
                        .map(StudentAcademicEnrollment::getStudent)
                        .distinct()
                        .collect(Collectors.toList());
            }
            case SECTION -> {
                List<StudentAcademicEnrollment> enrollments =
                        enrollmentRepo.findActiveEnrollmentsBySchoolYearAndClassGroup(
                                schoolId, academicYearId, scopeId);
                yield enrollments.stream()
                        .map(StudentAcademicEnrollment::getStudent)
                        .distinct()
                        .collect(Collectors.toList());
            }
            case CLASS -> {
                // Use the classGroup's gradeLevel to find all sections of that grade
                ClassGroup cg = classGroupRepo.findByIdAndSchool_Id(scopeId, schoolId)
                        .orElseThrow(() -> new IllegalArgumentException(
                                "ClassGroup not found for scope: " + scopeId));
                if (cg.getGradeLevel() == null) {
                    warnings.add("ClassGroup " + cg.getCode() + " has no gradeLevel; treating as SECTION scope.");
                    List<StudentAcademicEnrollment> enrollments =
                            enrollmentRepo.findActiveEnrollmentsBySchoolYearAndClassGroup(
                                    schoolId, academicYearId, scopeId);
                    yield enrollments.stream()
                            .map(StudentAcademicEnrollment::getStudent)
                            .distinct()
                            .collect(Collectors.toList());
                }
                List<StudentAcademicEnrollment> enrollments =
                        enrollmentRepo.findActiveEnrollmentsBySchoolYearAndGradeLevel(
                                schoolId, academicYearId, cg.getGradeLevel());
                yield enrollments.stream()
                        .map(StudentAcademicEnrollment::getStudent)
                        .distinct()
                        .collect(Collectors.toList());
            }
            case STUDENT -> {
                Optional<StudentAcademicEnrollment> enrollment =
                        enrollmentRepo.findActiveEnrollmentForStudent(schoolId, scopeId, academicYearId);
                if (enrollment.isEmpty()) {
                    warnings.add("Student " + scopeId + " has no active enrollment for this academic year; skipped.");
                    yield List.of();
                }
                yield List.of(enrollment.get().getStudent());
            }
        };
    }

    // ─── Core generation logic ────────────────────────────────────────────────

    /**
     * Shared generation / preview core.  When {@code persist} is {@code false}
     * we only count without writing to the database.
     */
    private DemandGenerationResultDTO runGeneration(Integer planId, boolean persist) {
        Integer schoolId = requireSchoolId();

        FeePlan plan = feePlanRepository.findByIdAndSchool_Id(planId, schoolId)
                .orElseThrow(() -> new IllegalArgumentException("Fee plan not found: " + planId));

        if (plan.getStatus() != FeePlanStatus.PUBLISHED) {
            throw new IllegalStateException("Only PUBLISHED fee plans can generate student demands. "
                    + "Current status: " + plan.getStatus());
        }

        School school = schoolRepo.findById(schoolId)
                .orElseThrow(() -> new IllegalStateException("School not found: " + schoolId));

        AcademicYear academicYear = plan.getAcademicYear();
        Integer academicYearId = academicYear.getId();

        List<FeePlanItem> items = feePlanItemRepository.findByFeePlan_IdOrderByIdAsc(planId);
        if (items.isEmpty()) {
            throw new IllegalStateException("Fee plan has no items — cannot generate demands.");
        }

        List<String> warnings = new ArrayList<>();
        int created = 0;
        int skipped = 0;
        BigDecimal totalAmount = BigDecimal.ZERO;
        Set<Integer> applicableStudentIds = new LinkedHashSet<>();

        // Fetch a stable base sequence. We increment per-demand below.
        long baseSeq = demandRepository.nextDemandSequence(schoolId);

        for (FeePlanItem item : items) {
            List<FeeInstallment> installments =
                    feeInstallmentRepository.findByFeePlanItem_IdOrderBySequenceAsc(item.getId());

            if (installments.isEmpty()) {
                warnings.add("Fee item '" + item.getFeeHead().getName() + "' (id=" + item.getId()
                        + ") has no installments — skipped.");
                continue;
            }

            List<Student> students = resolveStudents(item, schoolId, academicYearId, warnings);

            for (Student student : students) {
                applicableStudentIds.add(student.getId());

                for (FeeInstallment installment : installments) {
                    // Duplicate check
                    boolean exists = demandRepository.existsByStudent_IdAndFeePlanItem_IdAndInstallment_Id(
                            student.getId(), item.getId(), installment.getId());

                    if (exists) {
                        skipped++;
                        continue;
                    }

                    BigDecimal amount = installment.getAmount();
                    totalAmount = totalAmount.add(amount);
                    created++;

                    if (persist) {
                        StudentFeeDemand demand = new StudentFeeDemand();
                        demand.setSchool(school);
                        demand.setStudent(student);
                        demand.setAcademicYear(academicYear);
                        demand.setFeePlan(plan);
                        demand.setFeeHead(item.getFeeHead());
                        demand.setFeePlanItem(item);
                        demand.setInstallment(installment);
                        demand.setDemandNo(buildDemandNo(school, academicYear, baseSeq++));
                        demand.setDescription(item.getFeeHead().getName()
                                + " — " + installment.getName());
                        demand.setOriginalAmount(amount);
                        demand.setConcessionAmount(BigDecimal.ZERO);
                        demand.setFineAmount(BigDecimal.ZERO);
                        demand.setPayableAmount(amount);
                        demand.setPaidAmount(BigDecimal.ZERO);
                        demand.setBalanceAmount(amount);
                        demand.setDueDate(installment.getDueDate());
                        demand.setStatus(StudentFeeDemandStatus.UNPAID);
                        demandRepository.save(demand);
                    }
                }
            }
        }

        return DemandGenerationResultDTO.builder()
                .planId(planId)
                .planName(plan.getName())
                .dryRun(!persist)
                .totalApplicableStudents(applicableStudentIds.size())
                .createdDemands(persist ? created : created)
                .skippedExistingDemands(skipped)
                .totalAmountGenerated(totalAmount)
                .warnings(warnings)
                .build();
    }

    /**
     * Dry-run: compute what would be generated without persisting anything.
     */
    @Transactional(readOnly = true)
    public DemandGenerationResultDTO previewDemandGeneration(Integer planId) {
        return runGeneration(planId, false);
    }

    /**
     * Persist demands for the given published fee plan.
     * Idempotent — existing demands are skipped.
     */
    @Transactional
    public DemandGenerationResultDTO generateDemands(Integer planId) {
        DemandGenerationResultDTO result = runGeneration(planId, true);
        // TODO: audit(fee_demand.generated, schoolId, planId, createdDemands, triggeredByUserId)
        log.info("[AUDIT] fee_demand.generated planId={} created={} skipped={}",
                planId, result.getCreatedDemands(), result.getSkippedExistingDemands());
        return result;
    }

    // ─── Query methods ────────────────────────────────────────────────────────

    /**
     * Filtered list of demands for the current school.
     */
    @Transactional(readOnly = true)
    public List<StudentFeeDemandDTO> listDemands(
            Integer studentId,
            Integer classGroupId,
            Integer academicYearId,
            Integer feePlanId,
            String statusStr,
            LocalDate dueFrom,
            LocalDate dueTo) {

        Integer schoolId = requireSchoolId();
        StudentFeeDemandStatus status = statusStr != null
                ? StudentFeeDemandStatus.valueOf(statusStr.toUpperCase())
                : null;

        List<StudentFeeDemand> demands = demandRepository.findFiltered(
                schoolId, studentId, academicYearId, feePlanId, status, dueFrom, dueTo);

        // If classGroupId filter is requested, post-filter via enrollment
        if (classGroupId != null) {
            demands = demands.stream()
                    .filter(d -> classGroupId.equals(
                            d.getStudent().getClassGroup() != null
                                    ? d.getStudent().getClassGroup().getId()
                                    : null))
                    .collect(Collectors.toList());
        }

        return demands.stream().map(this::toDTO).collect(Collectors.toList());
    }

    /**
     * All demands for a specific student in the current school.
     */
    @Transactional(readOnly = true)
    public List<StudentFeeDemandDTO> getStudentDemands(Integer studentId) {
        Integer schoolId = requireSchoolId();
        return demandRepository.findBySchool_IdAndStudent_Id(schoolId, studentId)
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    // ─── Mapper ───────────────────────────────────────────────────────────────

    private StudentFeeDemandDTO toDTO(StudentFeeDemand d) {
        StudentFeeDemandDTO dto = new StudentFeeDemandDTO();
        dto.setId(d.getId());
        dto.setSchoolId(d.getSchool().getId());
        dto.setStudentId(d.getStudent().getId());
        String fullName = (d.getStudent().getFirstName()
                + (d.getStudent().getLastName() != null ? " " + d.getStudent().getLastName() : "")).trim();
        dto.setStudentName(fullName);
        dto.setAcademicYearId(d.getAcademicYear().getId());
        dto.setAcademicYearLabel(d.getAcademicYear().getLabel());
        dto.setFeePlanId(d.getFeePlan().getId());
        dto.setFeePlanName(d.getFeePlan().getName());
        dto.setFeeHeadId(d.getFeeHead().getId());
        dto.setFeeHeadCode(d.getFeeHead().getCode());
        dto.setFeeHeadName(d.getFeeHead().getName());
        dto.setFeePlanItemId(d.getFeePlanItem() != null ? d.getFeePlanItem().getId() : null);
        dto.setInstallmentId(d.getInstallment() != null ? d.getInstallment().getId() : null);
        dto.setInstallmentName(d.getInstallment() != null ? d.getInstallment().getName() : null);
        dto.setDemandNo(d.getDemandNo());
        dto.setDescription(d.getDescription());
        dto.setOriginalAmount(d.getOriginalAmount());
        dto.setConcessionAmount(d.getConcessionAmount());
        dto.setFineAmount(d.getFineAmount());
        dto.setPayableAmount(d.getPayableAmount());
        dto.setPaidAmount(d.getPaidAmount());
        dto.setBalanceAmount(d.getBalanceAmount());
        dto.setDueDate(d.getDueDate());
        dto.setStatus(d.getStatus());
        dto.setGeneratedAt(d.getGeneratedAt());
        dto.setCreatedAt(d.getCreatedAt());
        dto.setUpdatedAt(d.getUpdatedAt());
        return dto;
    }
}

