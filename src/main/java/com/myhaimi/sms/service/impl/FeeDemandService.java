package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.fee.DemandGenerationResultDTO;
import com.myhaimi.sms.DTO.fee.DemandSummaryDTO;
import com.myhaimi.sms.DTO.fee.StudentFeeDemandDTO;
import com.myhaimi.sms.entity.*;
import com.myhaimi.sms.entity.enums.ApplicableScopeType;
import com.myhaimi.sms.entity.enums.FeePlanStatus;
import com.myhaimi.sms.entity.enums.SequenceType;
import com.myhaimi.sms.entity.enums.StudentFeeDemandStatus;
import com.myhaimi.sms.entity.enums.StudentLifecycleStatus;
import com.myhaimi.sms.repository.*;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Generates and queries {@link StudentFeeDemand} records from a published {@link FeePlan}.
 *
 * <p><strong>Generation invariants:</strong>
 * <ul>
 *   <li>Plan must be PUBLISHED.</li>
 *   <li>Each plan item must have at least one installment.</li>
 *   <li>Only ACTIVE students receive demands.</li>
 *   <li>Student must have an active enrollment in the plan's academic year.</li>
 *   <li>One demand per (school_id, student_id, fee_plan_item_id, fee_installment_id) —
 *       enforced by a DB unique constraint; duplicates are caught and counted as skipped.</li>
 *   <li>Demand numbers use a locked school-scoped sequence (no COUNT+1).</li>
 *   <li>Dry-run does NOT advance the sequence.</li>
 * </ul>
 * </p>
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
    private final SchoolSequenceService sequenceService;

    // ─── helpers ──────────────────────────────────────────────────────────────

    private Integer requireSchoolId() {
        Integer id = TenantContext.getTenantId();
        if (id == null) throw new IllegalStateException("Missing school context");
        return id;
    }

    /**
     * Builds a collision-safe demand number using the school-scoped sequence service.
     * Format: {SCHOOLCODE}-{yearTag}-{seq:06d}
     */
    private String buildDemandNo(School school, AcademicYear academicYear, long seq) {
        String label   = academicYear.getLabel();
        String yearTag = label.replaceAll("[^0-9A-Za-z]", "")
                              .substring(0, Math.min(8, label.replaceAll("[^0-9A-Za-z]", "").length()));
        return String.format("%s-%s-%06d", school.getCode().toUpperCase(), yearTag, seq);
    }

    // ─── Scope priority ───────────────────────────────────────────────────────

    /**
     * Override priority: STUDENT (4) beats SECTION (3) beats CLASS (2) beats SCHOOL (1).
     * Higher number = more specific = wins.
     */
    private static final Map<ApplicableScopeType, Integer> SCOPE_PRIORITY = Map.of(
            ApplicableScopeType.SCHOOL,  1,
            ApplicableScopeType.CLASS,   2,
            ApplicableScopeType.SECTION, 3,
            ApplicableScopeType.STUDENT, 4
    );

    /**
     * Given a student and her enrolled class-group, returns the single {@link FeePlanItem}
     * from {@code candidateItems} (all for the same fee head) that should apply to her.
     *
     * <p>Resolution rule: most-specific scope wins.
     * Returns {@code null} if none of the candidates match.</p>
     */
    private FeePlanItem resolveWinningItem(Student student,
                                           ClassGroup studentClassGroup,
                                           List<FeePlanItem> candidateItems,
                                           Map<Integer, ClassGroup> classGroupCache) {
        FeePlanItem best = null;
        int bestPriority = -1;

        for (FeePlanItem item : candidateItems) {
            int priority = SCOPE_PRIORITY.getOrDefault(item.getApplicableScopeType(), 0);
            boolean matches = switch (item.getApplicableScopeType()) {
                case SCHOOL  -> true;
                case CLASS   -> {
                    ClassGroup itemCg = classGroupCache.get(item.getApplicableScopeId());
                    if (itemCg == null) yield false;
                    if (itemCg.getGradeLevel() != null && studentClassGroup.getGradeLevel() != null)
                        yield itemCg.getGradeLevel().equals(studentClassGroup.getGradeLevel());
                    // no gradeLevel: fall back to exact classGroup match
                    yield itemCg.getId().equals(studentClassGroup.getId());
                }
                case SECTION -> item.getApplicableScopeId().equals(studentClassGroup.getId());
                case STUDENT -> item.getApplicableScopeId().equals(student.getId());
            };

            if (matches && priority > bestPriority) {
                best = item;
                bestPriority = priority;
            }
        }
        return best;
    }

    // ─── Core generation logic ────────────────────────────────────────────────

    /**
     * Shared generation / preview core.
     *
     * <h3>Override algorithm</h3>
     * <ol>
     *   <li>Load all active student enrollments for the academic year.</li>
     *   <li>Group fee plan items by fee-head.</li>
     *   <li>For each student × fee-head, pick the MOST SPECIFIC applicable item
     *       (STUDENT &gt; SECTION &gt; CLASS &gt; SCHOOL).</li>
     *   <li>Generate one demand per winning-item installment.</li>
     * </ol>
     *
     * <p>When {@code persist} is {@code false} counts are computed but nothing is written
     * and the sequence is NOT advanced.</p>
     */
    private DemandGenerationResultDTO runGeneration(Integer planId, boolean persist) {
        Integer schoolId = requireSchoolId();

        FeePlan plan = feePlanRepository.findByIdAndSchool_Id(planId, schoolId)
                .orElseThrow(() -> new IllegalArgumentException("Fee plan not found: " + planId));

        if (plan.getStatus() != FeePlanStatus.PUBLISHED) {
            throw new IllegalStateException("Only PUBLISHED fee plans can generate student demands. "
                    + "Current status: " + plan.getStatus());
        }

        School       school       = schoolRepo.findById(schoolId)
                .orElseThrow(() -> new IllegalStateException("School not found: " + schoolId));
        AcademicYear academicYear    = plan.getAcademicYear();
        Integer      academicYearId  = academicYear.getId();

        List<FeePlanItem> allItems = feePlanItemRepository.findByFeePlan_IdOrderByIdAsc(planId);
        if (allItems.isEmpty()) {
            throw new IllegalStateException("Fee plan has no items — cannot generate demands.");
        }

        List<String> warnings     = new ArrayList<>();
        List<String> overrideNotes = new ArrayList<>();

        // ── Pre-load installments ────────────────────────────────────────────
        Map<Integer, List<FeeInstallment>> installmentsMap = new HashMap<>();
        for (FeePlanItem item : allItems) {
            List<FeeInstallment> insts =
                    feeInstallmentRepository.findByFeePlanItem_IdOrderBySequenceAsc(item.getId());
            installmentsMap.put(item.getId(), insts);
            if (insts.isEmpty()) {
                warnings.add("Fee rule '" + item.getFeeHead().getName()
                        + "' (" + item.getApplicableScopeType() + ") has no installments — skipped.");
            }
        }

        // Only items that have installments participate in demand generation
        List<FeePlanItem> validItems = allItems.stream()
                .filter(i -> !installmentsMap.getOrDefault(i.getId(), List.of()).isEmpty())
                .collect(Collectors.toList());

        if (validItems.isEmpty()) {
            return DemandGenerationResultDTO.builder()
                    .planId(planId).planName(plan.getName()).dryRun(!persist)
                    .totalApplicableStudents(0).createdDemands(0).skippedExistingDemands(0)
                    .totalAmountGenerated(BigDecimal.ZERO).warnings(warnings).overrideNotes(overrideNotes)
                    .build();
        }

        // ── Pre-load ClassGroups for CLASS-scoped items ─────────────────────
        Map<Integer, ClassGroup> classGroupCache = new HashMap<>();
        for (FeePlanItem item : validItems) {
            if (item.getApplicableScopeType() == ApplicableScopeType.CLASS) {
                Integer cgId = item.getApplicableScopeId();
                classGroupRepo.findByIdAndSchool_Id(cgId, schoolId)
                        .ifPresent(cg -> classGroupCache.put(cgId, cg));
            }
        }

        // ── Group valid items by fee-head ────────────────────────────────────
        Map<Integer, List<FeePlanItem>> itemsByFeeHead = validItems.stream()
                .collect(Collectors.groupingBy(i -> i.getFeeHead().getId()));

        // ── Load active enrollments (with classGroup eagerly fetched) ────────
        List<StudentAcademicEnrollment> allEnrollments =
                enrollmentRepo.findActiveEnrollmentsWithClassGroupBySchoolAndYear(schoolId, academicYearId);

        List<StudentAcademicEnrollment> activeEnrollments = allEnrollments.stream()
                .filter(e -> e.getStudent().getStatus() == StudentLifecycleStatus.ACTIVE)
                .collect(Collectors.toList());

        int inactiveCount = allEnrollments.size() - activeEnrollments.size();
        if (inactiveCount > 0) {
            warnings.add(inactiveCount + " non-ACTIVE student(s) skipped.");
        }

        // Warn if any STUDENT-scoped item references a student with no active enrollment
        Set<Integer> enrolledStudentIds = activeEnrollments.stream()
                .map(e -> e.getStudent().getId()).collect(Collectors.toSet());
        for (FeePlanItem item : validItems) {
            if (item.getApplicableScopeType() == ApplicableScopeType.STUDENT
                    && !enrolledStudentIds.contains(item.getApplicableScopeId())) {
                warnings.add("Student id=" + item.getApplicableScopeId()
                        + " ('" + item.getFeeHead().getName() + "') has no active enrollment — skipped.");
            }
        }

        // ── Build override notes for dry-run ─────────────────────────────────
        if (!persist) {
            buildOverrideNotes(itemsByFeeHead, classGroupCache, activeEnrollments, overrideNotes);
        }

        // ── Generate demands ─────────────────────────────────────────────────
        int          created             = 0;
        int          skipped             = 0;
        BigDecimal   totalAmount         = BigDecimal.ZERO;
        Set<Integer> applicableStudentIds = new LinkedHashSet<>();

        for (StudentAcademicEnrollment enrollment : activeEnrollments) {
            Student    student    = enrollment.getStudent();
            ClassGroup classGroup = enrollment.getClassGroup();

            for (Map.Entry<Integer, List<FeePlanItem>> entry : itemsByFeeHead.entrySet()) {
                FeePlanItem winning = resolveWinningItem(student, classGroup, entry.getValue(), classGroupCache);
                if (winning == null) continue;

                applicableStudentIds.add(student.getId());
                List<FeeInstallment> installments = installmentsMap.get(winning.getId());

                for (FeeInstallment installment : installments) {
                    boolean exists = demandRepository.existsBySchool_IdAndStudentItemInstallment(
                            schoolId, student.getId(), winning.getId(), installment.getId());
                    if (exists) {
                        skipped++;
                        continue;
                    }

                    BigDecimal amount = installment.getAmount();
                    totalAmount = totalAmount.add(amount);
                    created++;

                    if (persist) {
                        long seq = sequenceService.nextValue(schoolId, SequenceType.FEE_DEMAND);

                        StudentFeeDemand demand = new StudentFeeDemand();
                        demand.setSchool(school);
                        demand.setStudent(student);
                        demand.setAcademicYear(academicYear);
                        demand.setFeePlan(plan);
                        demand.setFeeHead(winning.getFeeHead());
                        demand.setFeePlanItem(winning);
                        demand.setInstallment(installment);
                        demand.setDemandNo(buildDemandNo(school, academicYear, seq));
                        demand.setDescription(winning.getFeeHead().getName() + " — " + installment.getName());
                        demand.setOriginalAmount(amount);
                        demand.setConcessionAmount(BigDecimal.ZERO);
                        demand.setFineAmount(BigDecimal.ZERO);
                        demand.setPayableAmount(amount);
                        demand.setPaidAmount(BigDecimal.ZERO);
                        demand.setBalanceAmount(amount);
                        demand.setDueDate(installment.getDueDate());
                        demand.setStatus(StudentFeeDemandStatus.UNPAID);

                        try {
                            demandRepository.save(demand);
                        } catch (DataIntegrityViolationException dive) {
                            log.warn("[fee_demand.generation] race-condition duplicate for student={} item={} installment={}",
                                    student.getId(), winning.getId(), installment.getId());
                            created--;
                            skipped++;
                            totalAmount = totalAmount.subtract(amount);
                        }
                    }
                }
            }
        }

        return DemandGenerationResultDTO.builder()
                .planId(planId)
                .planName(plan.getName())
                .dryRun(!persist)
                .totalApplicableStudents(applicableStudentIds.size())
                .createdDemands(created)
                .skippedExistingDemands(skipped)
                .totalAmountGenerated(totalAmount)
                .warnings(warnings)
                .overrideNotes(overrideNotes)
                .build();
    }

    /**
     * Builds human-readable override-effect notes for the dry-run preview.
     * Only populated when multiple items exist for the same fee head (i.e. overrides are present).
     */
    private void buildOverrideNotes(Map<Integer, List<FeePlanItem>> itemsByFeeHead,
                                    Map<Integer, ClassGroup> classGroupCache,
                                    List<StudentAcademicEnrollment> activeEnrollments,
                                    List<String> overrideNotes) {
        for (Map.Entry<Integer, List<FeePlanItem>> entry : itemsByFeeHead.entrySet()) {
            List<FeePlanItem> candidates = entry.getValue();
            if (candidates.size() <= 1) continue; // no overrides for this head

            String feeHeadName = candidates.get(0).getFeeHead().getName();
            Map<Integer, Long> countByItemId = new HashMap<>();

            for (StudentAcademicEnrollment enrollment : activeEnrollments) {
                FeePlanItem winning = resolveWinningItem(
                        enrollment.getStudent(), enrollment.getClassGroup(), candidates, classGroupCache);
                if (winning != null) {
                    countByItemId.merge(winning.getId(), 1L, Long::sum);
                }
            }

            // Sort by priority so notes appear in order SCHOOL → CLASS → SECTION → STUDENT
            candidates.stream()
                    .sorted(Comparator.comparingInt(i -> SCOPE_PRIORITY.getOrDefault(i.getApplicableScopeType(), 0)))
                    .forEach(item -> {
                        long count = countByItemId.getOrDefault(item.getId(), 0L);
                        if (count == 0) return;
                        String scopeDesc = switch (item.getApplicableScopeType()) {
                            case SCHOOL  -> "School-wide";
                            case CLASS   -> {
                                ClassGroup cg = classGroupCache.get(item.getApplicableScopeId());
                                yield (cg != null && cg.getGradeLevel() != null)
                                        ? "Grade " + cg.getGradeLevel() : "Class";
                            }
                            case SECTION -> "Section id=" + item.getApplicableScopeId();
                            case STUDENT -> "Student id=" + item.getApplicableScopeId();
                        };
                        overrideNotes.add(feeHeadName + " · " + scopeDesc
                                + ": " + count + " student" + (count == 1 ? "" : "s"));
                    });
        }
    }


    /**
     * Dry-run: compute what would be generated without persisting anything.
     * Does NOT advance any sequence.
     */
    @Transactional(readOnly = true)
    public DemandGenerationResultDTO previewDemandGeneration(Integer planId) {
        return runGeneration(planId, false);
    }

    /**
     * Persist demands for the given published fee plan.
     * Idempotent — existing demands are skipped gracefully.
     */
    @Transactional
    public DemandGenerationResultDTO generateDemands(Integer planId) {
        DemandGenerationResultDTO result = runGeneration(planId, true);
        log.info("[AUDIT] fee_demand.generated planId={} created={} skipped={}",
                planId, result.getCreatedDemands(), result.getSkippedExistingDemands());
        return result;
    }

    // ─── CSV Export ───────────────────────────────────────────────────────────

    /**
     * Builds a UTF-8 CSV string for all demands matching the given filters.
     * Columns: Demand No, Student Name, Admission No, Class/Section,
     *          Fee Plan, Fee Head, Installment, Due Date,
     *          Payable, Paid, Balance, Status.
     */
    @Transactional(readOnly = true)
    public String exportDemandsCsv(
            Integer studentId, Integer classGroupId, Integer gradeLevel, String sectionName,
            Integer academicYearId, Integer feePlanId, Integer feeHeadId, String statusStr,
            LocalDate dueFrom, LocalDate dueTo, String search) {

        Integer schoolId = requireSchoolId();
        StudentFeeDemandStatus status = statusStr != null
                ? StudentFeeDemandStatus.valueOf(statusStr.toUpperCase()) : null;
        String searchPat = (search != null && !search.isBlank())
                ? "%" + search.trim().toLowerCase() + "%" : null;

        List<StudentFeeDemand> demands = demandRepository.findFilteredAll(
                schoolId, studentId, academicYearId, feePlanId, feeHeadId,
                classGroupId, gradeLevel, sectionName, status, dueFrom, dueTo, searchPat);

        StringBuilder sb = new StringBuilder();
        sb.append("Demand No,Student Name,Admission No,Class / Section,Fee Plan,Fee Head,Installment,Due Date,Payable (INR),Paid (INR),Balance (INR),Status\n");
        for (StudentFeeDemand d : demands) {
            sb.append(csvCell(d.getDemandNo())).append(',');
            String name = (d.getStudent().getFirstName()
                    + (d.getStudent().getLastName() != null ? " " + d.getStudent().getLastName() : "")).trim();
            sb.append(csvCell(name)).append(',');
            sb.append(csvCell(d.getStudent().getAdmissionNo())).append(',');
            com.myhaimi.sms.entity.ClassGroup cg = d.getStudent().getClassGroup();
            sb.append(csvCell(cg != null ? cg.getDisplayName() : "")).append(',');
            sb.append(csvCell(d.getFeePlan().getName())).append(',');
            sb.append(csvCell(d.getFeeHead().getName())).append(',');
            sb.append(csvCell(d.getInstallment() != null ? d.getInstallment().getName() : "")).append(',');
            sb.append(csvCell(d.getDueDate() != null ? d.getDueDate().toString() : "")).append(',');
            sb.append(d.getPayableAmount()).append(',');
            sb.append(d.getPaidAmount()).append(',');
            sb.append(d.getBalanceAmount()).append(',');
            sb.append(csvCell(d.getStatus().name())).append('\n');
        }
        return sb.toString();
    }

    /** Quotes a CSV cell and escapes internal double-quotes. */
    private static String csvCell(String v) {
        if (v == null) return "\"\"";
        return "\"" + v.replace("\"", "\"\"") + "\"";
    }

    // ─── Query methods ────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<StudentFeeDemandDTO> listDemands(
            Integer studentId, Integer classGroupId, Integer academicYearId,
            Integer feePlanId, String statusStr, LocalDate dueFrom, LocalDate dueTo) {

        Integer schoolId = requireSchoolId();
        StudentFeeDemandStatus status = statusStr != null
                ? StudentFeeDemandStatus.valueOf(statusStr.toUpperCase())
                : null;

        List<StudentFeeDemand> demands = demandRepository.findFiltered(
                schoolId, studentId, academicYearId, feePlanId, status, dueFrom, dueTo);

        if (classGroupId != null) {
            demands = demands.stream()
                    .filter(d -> classGroupId.equals(
                            d.getStudent().getClassGroup() != null
                                    ? d.getStudent().getClassGroup().getId() : null))
                    .collect(Collectors.toList());
        }

        return demands.stream().map(this::toDTO).collect(Collectors.toList());
    }

    /**
     * Paginated demand list for the Student Dues admin screen.
     * Pass {@code classGroupId} for exact class+section, {@code gradeLevel} for class-only,
     * {@code sectionName} for section-only.  At most one of the three should be non-null.
     */
    @Transactional(readOnly = true)
    public Page<StudentFeeDemandDTO> listDemandsPaged(
            Integer studentId, Integer classGroupId, Integer gradeLevel, String sectionName,
            Integer academicYearId, Integer feePlanId, Integer feeHeadId, String statusStr,
            LocalDate dueFrom, LocalDate dueTo, String search,
            int page, int size) {

        Integer schoolId = requireSchoolId();
        StudentFeeDemandStatus status = statusStr != null
                ? StudentFeeDemandStatus.valueOf(statusStr.toUpperCase()) : null;
        String searchPat = (search != null && !search.isBlank())
                ? "%" + search.trim().toLowerCase() + "%" : null;

        Pageable pageable = PageRequest.of(page, Math.min(size, 200),
                Sort.by("dueDate").ascending().and(Sort.by("id").ascending()));

        return demandRepository.findFilteredPaged(
                schoolId, studentId, academicYearId, feePlanId, feeHeadId,
                classGroupId, gradeLevel, sectionName,
                status, dueFrom, dueTo, searchPat, pageable)
                .map(this::toDTO);
    }

    /**
     * Aggregate KPI summary for the full filtered result set (not paginated).
     */
    @Transactional(readOnly = true)
    public DemandSummaryDTO getDemandSummary(
            Integer studentId, Integer classGroupId, Integer gradeLevel, String sectionName,
            Integer academicYearId, Integer feePlanId, Integer feeHeadId, String statusStr,
            LocalDate dueFrom, LocalDate dueTo, String search) {

        Integer schoolId = requireSchoolId();
        String statusVal = statusStr != null ? statusStr.toUpperCase() : null;
        String searchPat = (search != null && !search.isBlank())
                ? "%" + search.trim().toLowerCase() + "%" : null;

        List<Object[]> rows = demandRepository.summarizeFiltered(
                schoolId, studentId, academicYearId, feePlanId, feeHeadId,
                classGroupId, gradeLevel, sectionName,
                statusVal, dueFrom, dueTo, searchPat, LocalDate.now());

        DemandSummaryDTO dto = new DemandSummaryDTO();
        if (rows == null || rows.isEmpty()) {
            dto.setTotalDemands(0L);
            dto.setTotalPayable(BigDecimal.ZERO);
            dto.setTotalPaid(BigDecimal.ZERO);
            dto.setTotalOutstanding(BigDecimal.ZERO);
            dto.setOverdueAmount(BigDecimal.ZERO);
            dto.setOverdueCount(0L);
            dto.setPartialBalance(BigDecimal.ZERO);
            return dto;
        }
        Object[] row = rows.get(0);
        dto.setTotalDemands(row[0] == null ? 0L : ((Number) row[0]).longValue());
        dto.setTotalPayable(toBD(row[1]));
        dto.setTotalPaid(toBD(row[2]));
        dto.setTotalOutstanding(toBD(row[3]));
        dto.setOverdueAmount(toBD(row[4]));
        dto.setOverdueCount(row[5] == null ? 0L : ((Number) row[5]).longValue());
        dto.setPartialBalance(toBD(row[6]));
        return dto;
    }

    private static BigDecimal toBD(Object o) {
        if (o == null) return BigDecimal.ZERO;
        if (o instanceof BigDecimal bd) return bd;
        return new BigDecimal(o.toString());
    }

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
        dto.setStudentAdmissionNo(d.getStudent().getAdmissionNo());
        // Populate class-group info for frontend filtering
        com.myhaimi.sms.entity.ClassGroup cg = d.getStudent().getClassGroup();
        if (cg != null) {
            dto.setClassGroupId(cg.getId());
            dto.setClassGroupName(cg.getDisplayName());
            dto.setClassGroupGradeLevel(cg.getGradeLevel());
            dto.setClassGroupSection(cg.getSection());
        }
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

