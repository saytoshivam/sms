package com.myhaimi.sms.modules.exam.service;

import com.myhaimi.sms.entity.*;
import com.myhaimi.sms.entity.enums.StudentLifecycleStatus;
import com.myhaimi.sms.modules.exam.dto.ResultCalculationRequestDTO;
import com.myhaimi.sms.modules.exam.dto.ResultActionRequestDTO;
import com.myhaimi.sms.modules.exam.dto.StudentResultComponentDTO;
import com.myhaimi.sms.modules.exam.dto.StudentResultDTO;
import com.myhaimi.sms.modules.exam.entity.*;
import com.myhaimi.sms.modules.exam.entity.enums.*;
import com.myhaimi.sms.modules.exam.repository.*;
import com.myhaimi.sms.repository.*;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ResultCalculationService {

    private final AssessmentSchemeRepository schemeRepo;
    private final AssessmentComponentRepository componentRepo;
    private final AssessmentInstanceRepository instanceRepo;
    private final StudentAssessmentMarkRepository markRepo;
    private final StudentResultRepository resultRepo;
    private final StudentResultComponentRepository resultComponentRepo;
    private final GradingSchemeRepository gradingSchemeRepo;
    private final GradingBandRepository gradingBandRepo;
    private final SchoolRepo schoolRepo;
    private final ClassGroupRepo classGroupRepo;
    private final SubjectRepo subjectRepo;
    private final StudentRepo studentRepo;
    private final AttendanceSessionRepo attendanceSessionRepo;
    private final StudentAttendanceRepo studentAttendanceRepo;
    private final AcademicYearRepo academicYearRepo;

    // ─────────────────────────────── Preview ──────────────────────────────────

    /**
     * Calculates and returns results without persisting them.
     */
    public List<StudentResultDTO> previewResult(ResultCalculationRequestDTO req) {
        Integer schoolId = requireSchoolId();
        Context ctx = buildContext(schoolId, req.classGroupId(), req.schemeId(), req.subjectId());
        GradingScheme gradingScheme = resolveGradingScheme(schoolId, ctx.scheme(), req.gradingSchemeId());

        return ctx.students().stream()
                .map(student -> computeResult(student, ctx, gradingScheme, false))
                .toList();
    }

    // ─────────────────────────────── Generate ─────────────────────────────────

    @Transactional
    public List<StudentResultDTO> generateResults(ResultCalculationRequestDTO req) {
        Integer schoolId = requireSchoolId();
        Context ctx = buildContext(schoolId, req.classGroupId(), req.schemeId(), req.subjectId());
        GradingScheme gradingScheme = resolveGradingScheme(schoolId, ctx.scheme(), req.gradingSchemeId());

        List<StudentResultDTO> results = new ArrayList<>();
        for (Student student : ctx.students()) {
            StudentResultDTO dto = computeResult(student, ctx, gradingScheme, false);
            StudentResult entity = persistResult(student, ctx, dto, schoolId);
            results.add(toDTO(entity));
        }
        return results;
    }

    // ─────────────────────────────── Lock ─────────────────────────────────────

    @Transactional
    public List<StudentResultDTO> lockResults(ResultActionRequestDTO req) {
        Integer schoolId = requireSchoolId();
        List<StudentResult> results = requireGeneratedResults(schoolId, req.classGroupId(), req.schemeId(), req.subjectId());
        results.forEach(r -> {
            if (r.getStatus() == ResultStatus.PUBLISHED) {
                throw new IllegalStateException("Cannot lock a PUBLISHED result for student " + r.getStudent().getId());
            }
            r.setStatus(ResultStatus.LOCKED);
        });
        return resultRepo.saveAll(results).stream().map(this::toDTO).toList();
    }

    // ─────────────────────────────── Publish ──────────────────────────────────

    @Transactional
    public List<StudentResultDTO> publishResults(ResultActionRequestDTO req) {
        Integer schoolId = requireSchoolId();
        List<StudentResult> results = requireGeneratedResults(schoolId, req.classGroupId(), req.schemeId(), req.subjectId());
        Instant now = Instant.now();
        results.forEach(r -> {
            r.setStatus(ResultStatus.PUBLISHED);
            r.setPublishedAt(now);
        });
        return resultRepo.saveAll(results).stream().map(this::toDTO).toList();
    }

    // ─────────────────────────────── List results ─────────────────────────────

    public List<StudentResultDTO> listResults(
            Integer classGroupId, Integer schemeId, Integer subjectId, ResultStatus status) {
        Integer schoolId = requireSchoolId();
        return resultRepo.listForFilters(schoolId, classGroupId, schemeId, subjectId, status)
                .stream().map(this::toDTO).toList();
    }

    public List<StudentResultDTO> getStudentResults(Integer studentId) {
        Integer schoolId = requireSchoolId();
        return resultRepo.findByStudent_IdAndSchool_Id(studentId, schoolId)
                .stream().map(this::toDTO).toList();
    }

    // ─────────────────────────────── Calculation core ─────────────────────────

    private StudentResultDTO computeResult(Student student, Context ctx, GradingScheme gradingScheme, boolean preview) {
        List<StudentResultComponentDTO> componentDTOs = new ArrayList<>();
        BigDecimal totalWeighted = BigDecimal.ZERO;
        BigDecimal totalWeightage = BigDecimal.ZERO;

        for (AssessmentComponent component : ctx.scheme().getComponents()) {
            CalculationRule rule = component.getCalculationRule();

            if (rule == CalculationRule.MANUAL) {
                // Skip — require manual input
                continue;
            }

            StudentResultComponentDTO compDTO = calculateComponent(student, component, ctx);
            componentDTOs.add(compDTO);

            if (compDTO.weightedScore() != null) {
                totalWeighted = totalWeighted.add(compDTO.weightedScore());
            }
            totalWeightage = totalWeightage.add(component.getWeightagePercent());
        }

        // percentage = totalWeighted / totalWeightage * 100 (handle partial weightage schemes)
        BigDecimal percentage;
        if (totalWeightage.compareTo(BigDecimal.ZERO) > 0) {
            percentage = totalWeighted
                    .divide(totalWeightage, 10, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100))
                    .setScale(2, RoundingMode.HALF_UP);
        } else {
            percentage = BigDecimal.ZERO;
        }

        String grade = resolveGrade(gradingScheme, percentage);

        return new StudentResultDTO(
                null,
                ctx.school().getId(),
                ctx.scheme().getAcademicYear().getId(),
                ctx.scheme().getAcademicYear().getLabel(),
                student.getId(),
                buildFullName(student),
                student.getAdmissionNo(),
                ctx.classGroup().getId(),
                ctx.classGroup().getDisplayName(),
                ctx.scheme().getId(),
                ctx.scheme().getName(),
                ctx.subject().getId(),
                ctx.subject().getName(),
                totalWeighted.setScale(4, RoundingMode.HALF_UP),
                percentage,
                grade,
                ResultStatus.GENERATED,
                Instant.now(),
                null,
                null,
                null,
                componentDTOs
        );
    }

    private StudentResultComponentDTO calculateComponent(
            Student student, AssessmentComponent component, Context ctx) {

        CalculationRule rule = component.getCalculationRule();

        if (rule == CalculationRule.ATTENDANCE_PERCENTAGE) {
            return calculateAttendanceComponent(student, component, ctx);
        }

        // Fetch all assessment instances for this component + class + subject
        List<AssessmentInstance> instances = instanceRepo
                .findByScheme_IdAndComponent_IdOrderByClassGroup_IdAscSubject_IdAscSequenceAsc(
                        ctx.scheme().getId(), component.getId())
                .stream()
                .filter(i -> i.getClassGroup().getId().equals(ctx.classGroup().getId())
                        && i.getSubject().getId().equals(ctx.subject().getId())
                        && i.getStatus() != AssessmentInstanceStatus.CANCELLED)
                .toList();

        if (instances.isEmpty()) {
            return buildEmptyComponent(component, "No assessment instances found");
        }

        List<Integer> instanceIds = instances.stream().map(AssessmentInstance::getId).toList();
        Map<Integer, StudentAssessmentMark> markByInstanceId = markRepo
                .findAllByInstanceIds(instanceIds)
                .stream()
                .filter(m -> m.getStudent().getId().equals(student.getId()))
                .collect(Collectors.toMap(m -> m.getAssessmentInstance().getId(), m -> m));

        return switch (rule) {
            case SINGLE_ASSESSMENT -> calcSingle(component, instances, markByInstanceId);
            case BEST_N_OF_M -> calcBestNOfM(component, instances, markByInstanceId);
            case SUM -> calcSum(component, instances, markByInstanceId);
            case AVERAGE -> calcAverage(component, instances, markByInstanceId);
            case HIGHEST -> calcHighest(component, instances, markByInstanceId);
            default -> buildEmptyComponent(component, "Rule not supported: " + rule);
        };
    }

    /** SINGLE_ASSESSMENT: use the first (or only) instance mark. */
    private StudentResultComponentDTO calcSingle(
            AssessmentComponent component,
            List<AssessmentInstance> instances,
            Map<Integer, StudentAssessmentMark> markByInstanceId) {

        AssessmentInstance instance = instances.get(0);
        StudentAssessmentMark mark = markByInstanceId.get(instance.getId());
        BigDecimal rawScore = (mark != null && !mark.isAbsent() && mark.getMarksObtained() != null)
                ? mark.getMarksObtained() : BigDecimal.ZERO;
        BigDecimal rawMax = instance.getMaxMarks();
        BigDecimal weighted = computeWeighted(rawScore, rawMax, component.getWeightagePercent());

        String details = String.format("{\"rule\":\"SINGLE_ASSESSMENT\",\"instanceId\":%d,\"marks\":%s,\"max\":%s}",
                instance.getId(), rawScore, rawMax);
        return buildComponent(component, rawScore, rawMax, weighted, details);
    }

    /** BEST_N_OF_M: pick top bestOfCount marks. */
    private StudentResultComponentDTO calcBestNOfM(
            AssessmentComponent component,
            List<AssessmentInstance> instances,
            Map<Integer, StudentAssessmentMark> markByInstanceId) {

        int bestOf = component.getBestOfCount() != null ? component.getBestOfCount() : 1;

        record InstMark(AssessmentInstance inst, BigDecimal marks) {}

        List<InstMark> scored = instances.stream()
                .map(i -> {
                    StudentAssessmentMark m = markByInstanceId.get(i.getId());
                    BigDecimal marks = (m != null && !m.isAbsent() && m.getMarksObtained() != null)
                            ? m.getMarksObtained() : BigDecimal.ZERO;
                    return new InstMark(i, marks);
                })
                .sorted(Comparator.comparing(InstMark::marks).reversed())
                .toList();

        List<InstMark> selected = scored.stream().limit(bestOf).toList();
        BigDecimal rawScore = selected.stream().map(InstMark::marks)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal rawMax = selected.stream().map(im -> im.inst().getMaxMarks())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal weighted = computeWeighted(rawScore, rawMax, component.getWeightagePercent());

        String selectedIds = selected.stream().map(im -> String.valueOf(im.inst().getId()))
                .collect(Collectors.joining(","));
        String details = String.format(
                "{\"rule\":\"BEST_N_OF_M\",\"bestOf\":%d,\"selectedInstanceIds\":[%s],\"rawScore\":%s,\"rawMax\":%s}",
                bestOf, selectedIds, rawScore, rawMax);
        return buildComponent(component, rawScore, rawMax, weighted, details);
    }

    /** SUM: sum all marks and max marks. */
    private StudentResultComponentDTO calcSum(
            AssessmentComponent component,
            List<AssessmentInstance> instances,
            Map<Integer, StudentAssessmentMark> markByInstanceId) {

        BigDecimal rawScore = BigDecimal.ZERO;
        BigDecimal rawMax = BigDecimal.ZERO;
        for (AssessmentInstance inst : instances) {
            StudentAssessmentMark m = markByInstanceId.get(inst.getId());
            BigDecimal marks = (m != null && !m.isAbsent() && m.getMarksObtained() != null)
                    ? m.getMarksObtained() : BigDecimal.ZERO;
            rawScore = rawScore.add(marks);
            rawMax = rawMax.add(inst.getMaxMarks());
        }
        BigDecimal weighted = computeWeighted(rawScore, rawMax, component.getWeightagePercent());
        String details = String.format("{\"rule\":\"SUM\",\"rawScore\":%s,\"rawMax\":%s,\"count\":%d}",
                rawScore, rawMax, instances.size());
        return buildComponent(component, rawScore, rawMax, weighted, details);
    }

    /** AVERAGE: average percentage across all assessments. */
    private StudentResultComponentDTO calcAverage(
            AssessmentComponent component,
            List<AssessmentInstance> instances,
            Map<Integer, StudentAssessmentMark> markByInstanceId) {

        if (instances.isEmpty()) return buildEmptyComponent(component, "No instances");

        BigDecimal totalPct = BigDecimal.ZERO;
        int count = 0;
        for (AssessmentInstance inst : instances) {
            StudentAssessmentMark m = markByInstanceId.get(inst.getId());
            BigDecimal marks = (m != null && !m.isAbsent() && m.getMarksObtained() != null)
                    ? m.getMarksObtained() : BigDecimal.ZERO;
            BigDecimal max = inst.getMaxMarks();
            if (max.compareTo(BigDecimal.ZERO) > 0) {
                totalPct = totalPct.add(marks.divide(max, 10, RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(100)));
            }
            count++;
        }

        BigDecimal avgPct = count > 0
                ? totalPct.divide(BigDecimal.valueOf(count), 10, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;
        // rawScore = avgPct, rawMax = 100 (percentage scale)
        BigDecimal rawMax = BigDecimal.valueOf(100);
        BigDecimal weighted = computeWeighted(avgPct, rawMax, component.getWeightagePercent());
        String details = String.format("{\"rule\":\"AVERAGE\",\"avgPercent\":%s,\"count\":%d}",
                avgPct.setScale(4, RoundingMode.HALF_UP), count);
        return buildComponent(component, avgPct, rawMax, weighted, details);
    }

    /** HIGHEST: pick the single highest mark. */
    private StudentResultComponentDTO calcHighest(
            AssessmentComponent component,
            List<AssessmentInstance> instances,
            Map<Integer, StudentAssessmentMark> markByInstanceId) {

        AssessmentInstance bestInst = null;
        BigDecimal bestMarks = BigDecimal.ZERO;
        for (AssessmentInstance inst : instances) {
            StudentAssessmentMark m = markByInstanceId.get(inst.getId());
            BigDecimal marks = (m != null && !m.isAbsent() && m.getMarksObtained() != null)
                    ? m.getMarksObtained() : BigDecimal.ZERO;
            if (marks.compareTo(bestMarks) > 0 || bestInst == null) {
                bestMarks = marks;
                bestInst = inst;
            }
        }
        BigDecimal rawMax = bestInst != null ? bestInst.getMaxMarks() : BigDecimal.ONE;
        BigDecimal weighted = computeWeighted(bestMarks, rawMax, component.getWeightagePercent());
        String details = String.format("{\"rule\":\"HIGHEST\",\"instanceId\":%s,\"marks\":%s,\"max\":%s}",
                bestInst != null ? bestInst.getId() : null, bestMarks, rawMax);
        return buildComponent(component, bestMarks, rawMax, weighted, details);
    }

    /** ATTENDANCE_PERCENTAGE: compute from attendance sessions for the academic year. */
    private StudentResultComponentDTO calculateAttendanceComponent(
            Student student, AssessmentComponent component, Context ctx) {

        AcademicYear ay = ctx.scheme().getAcademicYear();
        LocalDate from = ay.getStartsOn();
        LocalDate to = ay.getEndsOn();

        // Count total daily sessions for the class in the academic year
        List<AttendanceSession> sessions = attendanceSessionRepo
                .findBySchool_IdAndClassGroup_IdAndDateBetweenAndLectureIsNull(
                        ctx.school().getId(), ctx.classGroup().getId(), from, to);

        long totalSessions = sessions.size();
        if (totalSessions == 0) {
            return buildComponent(component, BigDecimal.ZERO, BigDecimal.valueOf(100),
                    BigDecimal.ZERO, "{\"rule\":\"ATTENDANCE_PERCENTAGE\",\"totalSessions\":0}");
        }

        List<Integer> sessionIds = sessions.stream().map(AttendanceSession::getId).toList();
        long presentCount = studentAttendanceRepo
                .findByStudent_IdIn(List.of(student.getId()))
                .stream()
                .filter(a -> sessionIds.contains(a.getAttendanceSession().getId()))
                .filter(a -> "PRESENT".equalsIgnoreCase(a.getStatus()) || "LATE".equalsIgnoreCase(a.getStatus()))
                .count();

        BigDecimal attendancePct = BigDecimal.valueOf(presentCount)
                .divide(BigDecimal.valueOf(totalSessions), 10, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100))
                .setScale(4, RoundingMode.HALF_UP);

        BigDecimal weighted = attendancePct
                .multiply(component.getWeightagePercent())
                .divide(BigDecimal.valueOf(100), 10, RoundingMode.HALF_UP)
                .setScale(4, RoundingMode.HALF_UP);

        String details = String.format(
                "{\"rule\":\"ATTENDANCE_PERCENTAGE\",\"present\":%d,\"total\":%d,\"percent\":%s}",
                presentCount, totalSessions, attendancePct);
        return buildComponent(component, attendancePct, BigDecimal.valueOf(100), weighted, details);
    }

    // ─────────────────────────────── Persist ──────────────────────────────────

    @Transactional
    private StudentResult persistResult(Student student, Context ctx, StudentResultDTO dto, Integer schoolId) {
        Optional<StudentResult> existing = resultRepo.findByStudent_IdAndSubject_IdAndScheme_Id(
                student.getId(), ctx.subject().getId(), ctx.scheme().getId());

        StudentResult result;
        if (existing.isPresent()) {
            result = existing.get();
            if (result.getStatus() == ResultStatus.PUBLISHED) {
                throw new IllegalStateException(
                        "Result for student " + student.getId() + " is PUBLISHED and cannot be regenerated");
            }
            // Remove old components and recalculate
            resultComponentRepo.deleteByStudentResult_Id(result.getId());
            resultComponentRepo.flush();
        } else {
            result = new StudentResult();
            result.setSchool(ctx.school());
            result.setAcademicYear(ctx.scheme().getAcademicYear());
            result.setStudent(student);
            result.setClassGroup(ctx.classGroup());
            result.setScheme(ctx.scheme());
            result.setSubject(ctx.subject());
        }

        result.setTotalWeightedScore(dto.totalWeightedScore());
        result.setPercentage(dto.percentage());
        result.setGrade(dto.grade());
        result.setStatus(ResultStatus.GENERATED);
        result.setGeneratedAt(Instant.now());
        result = resultRepo.save(result);

        for (StudentResultComponentDTO compDTO : dto.components()) {
            AssessmentComponent ac = componentRepo.findById(compDTO.assessmentComponentId())
                    .orElseThrow();
            StudentResultComponent src = new StudentResultComponent();
            src.setStudentResult(result);
            src.setAssessmentComponent(ac);
            src.setRawScore(compDTO.rawScore());
            src.setRawMax(compDTO.rawMax());
            src.setWeightedScore(compDTO.weightedScore());
            src.setWeightagePercent(compDTO.weightagePercent());
            src.setCalculationDetailsJson(compDTO.calculationDetailsJson());
            resultComponentRepo.save(src);
        }

        return resultRepo.findById(result.getId()).orElseThrow();
    }

    // ─────────────────────────────── Grading ──────────────────────────────────

    private String resolveGrade(GradingScheme gs, BigDecimal percentage) {
        if (gs == null || percentage == null) return null;
        return gs.getBands().stream()
                .filter(b -> percentage.compareTo(b.getMinPercent()) >= 0
                        && percentage.compareTo(b.getMaxPercent()) <= 0)
                .map(GradingBand::getGrade)
                .findFirst()
                .orElse(null);
    }

    private GradingScheme resolveGradingScheme(Integer schoolId, AssessmentScheme scheme, Integer gradingSchemeId) {
        if (gradingSchemeId != null) {
            return gradingSchemeRepo.findByIdAndSchool_Id(gradingSchemeId, schoolId)
                    .orElseThrow(() -> new NoSuchElementException("Grading scheme not found: " + gradingSchemeId));
        }
        // Try active scheme for the same academic year first, then any active scheme for the school
        return gradingSchemeRepo.findBySchool_IdOrderByCreatedAtAsc(schoolId)
                .stream()
                .filter(gs -> gs.isActive()
                        && (gs.getAcademicYear() == null
                        || gs.getAcademicYear().getId().equals(scheme.getAcademicYear().getId())))
                .findFirst()
                .orElseGet(() -> gradingSchemeRepo.findBySchool_IdOrderByCreatedAtAsc(schoolId)
                        .stream().filter(GradingScheme::isActive).findFirst().orElse(null));
    }

    // ─────────────────────────────── Context builders ─────────────────────────

    private record Context(School school, AssessmentScheme scheme, ClassGroup classGroup,
                           Subject subject, List<Student> students) {}

    private Context buildContext(Integer schoolId, Integer classGroupId, Integer schemeId, Integer subjectId) {
        School school = schoolRepo.findById(schoolId)
                .orElseThrow(() -> new NoSuchElementException("School not found"));

        AssessmentScheme scheme = schemeRepo.findByIdAndSchool_Id(schemeId, schoolId)
                .orElseThrow(() -> new NoSuchElementException("Assessment scheme not found"));

        if (scheme.getStatus() != AssessmentSchemeStatus.PUBLISHED) {
            throw new IllegalStateException(
                    "Assessment scheme must be PUBLISHED before calculating results. Current: " + scheme.getStatus());
        }

        ClassGroup classGroup = classGroupRepo.findById(classGroupId)
                .orElseThrow(() -> new NoSuchElementException("Class group not found"));
        if (!classGroup.getSchool().getId().equals(schoolId)) {
            throw new IllegalArgumentException("Class group does not belong to this school");
        }

        Subject subject = subjectRepo.findById(subjectId)
                .orElseThrow(() -> new NoSuchElementException("Subject not found"));

        List<Student> students = studentRepo
                .findBySchool_IdAndClassGroup_IdOrderByLastNameAscFirstNameAsc(schoolId, classGroupId)
                .stream()
                .filter(s -> s.getStatus() == StudentLifecycleStatus.ACTIVE)
                .toList();

        if (students.isEmpty()) {
            throw new IllegalStateException("No active students found in the class group");
        }

        return new Context(school, scheme, classGroup, subject, students);
    }

    private List<StudentResult> requireGeneratedResults(
            Integer schoolId, Integer classGroupId, Integer schemeId, Integer subjectId) {
        List<StudentResult> results = resultRepo.findBySchool_IdAndClassGroup_IdAndScheme_IdAndSubject_Id(
                schoolId, classGroupId, schemeId, subjectId);
        if (results.isEmpty()) {
            throw new IllegalStateException(
                    "No generated results found. Run generate first.");
        }
        return results;
    }

    // ─────────────────────────────── Helpers ──────────────────────────────────

    private BigDecimal computeWeighted(BigDecimal rawScore, BigDecimal rawMax, BigDecimal weightage) {
        if (rawMax == null || rawMax.compareTo(BigDecimal.ZERO) == 0) return BigDecimal.ZERO;
        return rawScore.divide(rawMax, 10, RoundingMode.HALF_UP)
                .multiply(weightage)
                .setScale(4, RoundingMode.HALF_UP);
    }

    private StudentResultComponentDTO buildComponent(
            AssessmentComponent component,
            BigDecimal rawScore,
            BigDecimal rawMax,
            BigDecimal weighted,
            String details) {
        return new StudentResultComponentDTO(
                null,
                component.getId(),
                component.getName(),
                component.getCalculationRule().name(),
                rawScore != null ? rawScore.setScale(4, RoundingMode.HALF_UP) : null,
                rawMax != null ? rawMax.setScale(4, RoundingMode.HALF_UP) : null,
                weighted != null ? weighted.setScale(4, RoundingMode.HALF_UP) : null,
                component.getWeightagePercent(),
                details
        );
    }

    private StudentResultComponentDTO buildEmptyComponent(AssessmentComponent component, String reason) {
        String details = String.format("{\"skipped\":true,\"reason\":\"%s\"}", reason);
        return buildComponent(component, null, null, null, details);
    }

    private static String buildFullName(Student student) {
        StringBuilder sb = new StringBuilder();
        if (student.getFirstName() != null) sb.append(student.getFirstName());
        if (student.getMiddleName() != null && !student.getMiddleName().isBlank()) {
            sb.append(' ').append(student.getMiddleName());
        }
        if (student.getLastName() != null && !student.getLastName().isBlank()) {
            sb.append(' ').append(student.getLastName());
        }
        return sb.toString().trim();
    }

    private Integer requireSchoolId() {
        Integer id = TenantContext.getTenantId();
        if (id == null) throw new IllegalStateException("Missing school context");
        return id;
    }

    // ─────────────────────────────── Mapper ───────────────────────────────────

    private StudentResultDTO toDTO(StudentResult r) {
        List<StudentResultComponentDTO> compDTOs = r.getComponents().stream()
                .map(c -> new StudentResultComponentDTO(
                        c.getId(),
                        c.getAssessmentComponent().getId(),
                        c.getAssessmentComponent().getName(),
                        c.getAssessmentComponent().getCalculationRule().name(),
                        c.getRawScore(),
                        c.getRawMax(),
                        c.getWeightedScore(),
                        c.getWeightagePercent(),
                        c.getCalculationDetailsJson()
                ))
                .toList();

        String ayLabel = r.getAcademicYear() != null ? r.getAcademicYear().getLabel() : null;
        return new StudentResultDTO(
                r.getId(),
                r.getSchool().getId(),
                r.getAcademicYear() != null ? r.getAcademicYear().getId() : null,
                ayLabel,
                r.getStudent().getId(),
                buildFullName(r.getStudent()),
                r.getStudent().getAdmissionNo(),
                r.getClassGroup().getId(),
                r.getClassGroup().getDisplayName(),
                r.getScheme().getId(),
                r.getScheme().getName(),
                r.getSubject().getId(),
                r.getSubject().getName(),
                r.getTotalWeightedScore(),
                r.getPercentage(),
                r.getGrade(),
                r.getStatus(),
                r.getGeneratedAt(),
                r.getPublishedAt(),
                r.getCreatedAt(),
                r.getUpdatedAt(),
                compDTOs
        );
    }
}

