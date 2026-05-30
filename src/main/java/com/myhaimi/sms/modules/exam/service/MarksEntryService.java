package com.myhaimi.sms.modules.exam.service;

import com.myhaimi.sms.entity.School;
import com.myhaimi.sms.entity.Student;
import com.myhaimi.sms.entity.enums.StudentLifecycleStatus;
import com.myhaimi.sms.modules.exam.dto.MarksEntryBulkSaveDTO;
import com.myhaimi.sms.modules.exam.dto.MarksEntryRowDTO;
import com.myhaimi.sms.modules.exam.dto.MarksEntrySheetDTO;
import com.myhaimi.sms.modules.exam.dto.MarksEntrySubmitDTO;
import com.myhaimi.sms.modules.exam.entity.AssessmentInstance;
import com.myhaimi.sms.modules.exam.entity.StudentAssessmentMark;
import com.myhaimi.sms.modules.exam.entity.enums.AssessmentInstanceStatus;
import com.myhaimi.sms.modules.exam.entity.enums.MarkStatus;
import com.myhaimi.sms.modules.exam.repository.AssessmentInstanceRepository;
import com.myhaimi.sms.modules.exam.repository.StudentAssessmentMarkRepository;
import com.myhaimi.sms.repository.SchoolRepo;
import com.myhaimi.sms.repository.StudentRepo;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MarksEntryService {

    private final AssessmentInstanceRepository instanceRepo;
    private final StudentAssessmentMarkRepository markRepo;
    private final StudentRepo studentRepo;
    private final SchoolRepo schoolRepo;

    // ─────────────────────────────── Get sheet ────────────────────────────────

    /**
     * Builds the full marks-entry sheet for an assessment instance.
     * Returns one row per active student in the assessment's classGroup.
     * Rows are pre-filled from existing mark records; new students appear with null markId.
     */
    public MarksEntrySheetDTO getMarksEntrySheet(Integer assessmentInstanceId) {
        Integer schoolId = requireSchoolId();
        AssessmentInstance instance = requireInstance(assessmentInstanceId, schoolId);

        // Fetch all active students in the class
        List<Student> students = studentRepo
                .findBySchool_IdAndClassGroup_IdOrderByLastNameAscFirstNameAsc(schoolId, instance.getClassGroup().getId())
                .stream()
                .filter(s -> s.getStatus() == StudentLifecycleStatus.ACTIVE)
                .toList();

        // Fetch existing marks indexed by studentId
        Map<Integer, StudentAssessmentMark> markByStudentId = markRepo
                .findAllByInstance(assessmentInstanceId)
                .stream()
                .collect(Collectors.toMap(m -> m.getStudent().getId(), Function.identity()));

        List<MarksEntryRowDTO> rows = students.stream()
                .map(s -> toRowDTO(s, markByStudentId.get(s.getId())))
                .toList();

        String classLabel = instance.getClassGroup().getDisplayName();
        if (classLabel == null || classLabel.isBlank()) {
            classLabel = instance.getClassGroup().getCode();
        }

        return new MarksEntrySheetDTO(
                instance.getId(),
                instance.getName(),
                instance.getComponent().getName(),
                instance.getScheme().getName(),
                classLabel,
                instance.getSubject().getName(),
                instance.getAssessmentDate(),
                instance.getMaxMarks(),
                instance.getStatus(),
                rows
        );
    }

    // ─────────────────────────────── Save draft ───────────────────────────────

    @Transactional
    public MarksEntrySheetDTO saveDraftMarks(Integer assessmentInstanceId, MarksEntryBulkSaveDTO dto) {
        Integer schoolId = requireSchoolId();
        AssessmentInstance instance = requireInstance(assessmentInstanceId, schoolId);
        requireMarksEntryOpen(instance);

        String actor = resolveActor();
        School school = requireSchool(schoolId);

        upsertMarks(instance, school, dto.rows(), MarkStatus.DRAFT, actor, false);
        return getMarksEntrySheet(assessmentInstanceId);
    }

    // ─────────────────────────────── Submit marks ─────────────────────────────

    @Transactional
    public MarksEntrySheetDTO submitMarks(Integer assessmentInstanceId, MarksEntryBulkSaveDTO dto) {
        Integer schoolId = requireSchoolId();
        AssessmentInstance instance = requireInstance(assessmentInstanceId, schoolId);
        requireMarksEntryOpen(instance);

        String actor = resolveActor();
        School school = requireSchool(schoolId);
        Instant now = Instant.now();

        upsertMarks(instance, school, dto.rows(), MarkStatus.SUBMITTED, actor, true);

        // Transition assessment status to MARKS_SUBMITTED if all rows are submitted
        long totalStudents = studentRepo
                .findBySchool_IdAndClassGroup_IdOrderByLastNameAscFirstNameAsc(schoolId, instance.getClassGroup().getId())
                .stream().filter(s -> s.getStatus() == StudentLifecycleStatus.ACTIVE).count();
        long submittedCount = markRepo.countByAssessmentInstance_Id(assessmentInstanceId);

        if (submittedCount >= totalStudents && totalStudents > 0) {
            instance.setStatus(AssessmentInstanceStatus.MARKS_SUBMITTED);
            instanceRepo.save(instance);
        }

        // Update submittedAt on all submitted marks
        markRepo.findAllByInstance(assessmentInstanceId)
                .stream()
                .filter(m -> m.getStatus() == MarkStatus.SUBMITTED && m.getSubmittedAt() == null)
                .forEach(m -> {
                    m.setSubmittedAt(now);
                    markRepo.save(m);
                });

        return getMarksEntrySheet(assessmentInstanceId);
    }

    // ─────────────────────────────── Lock marks ───────────────────────────────

    @Transactional
    public MarksEntrySheetDTO lockMarks(Integer assessmentInstanceId) {
        Integer schoolId = requireSchoolId();
        AssessmentInstance instance = requireInstance(assessmentInstanceId, schoolId);

        if (instance.getStatus() == AssessmentInstanceStatus.CANCELLED) {
            throw new IllegalStateException("Cannot lock a cancelled assessment");
        }
        if (instance.getStatus() == AssessmentInstanceStatus.LOCKED) {
            throw new IllegalStateException("Assessment is already locked");
        }

        Instant now = Instant.now();
        markRepo.findAllByInstance(assessmentInstanceId)
                .forEach(m -> {
                    if (m.getStatus() != MarkStatus.LOCKED) {
                        m.setStatus(MarkStatus.LOCKED);
                        m.setLockedAt(now);
                        markRepo.save(m);
                    }
                });

        instance.setStatus(AssessmentInstanceStatus.LOCKED);
        instanceRepo.save(instance);

        return getMarksEntrySheet(assessmentInstanceId);
    }

    // ─────────────────────────────── Reopen (admin) ───────────────────────────

    @Transactional
    public MarksEntrySheetDTO reopenMarks(Integer assessmentInstanceId) {
        Integer schoolId = requireSchoolId();
        AssessmentInstance instance = requireInstance(assessmentInstanceId, schoolId);

        if (instance.getStatus() != AssessmentInstanceStatus.LOCKED
                && instance.getStatus() != AssessmentInstanceStatus.MARKS_SUBMITTED) {
            throw new IllegalStateException("Can only reopen LOCKED or MARKS_SUBMITTED assessments");
        }

        markRepo.findAllByInstance(assessmentInstanceId)
                .stream()
                .filter(m -> m.getStatus() == MarkStatus.LOCKED)
                .forEach(m -> {
                    m.setStatus(MarkStatus.SUBMITTED);
                    m.setLockedAt(null);
                    markRepo.save(m);
                });

        instance.setStatus(AssessmentInstanceStatus.MARKS_ENTRY_OPEN);
        instanceRepo.save(instance);

        return getMarksEntrySheet(assessmentInstanceId);
    }

    // ─────────────────────────────── Internals ────────────────────────────────

    private void upsertMarks(
            AssessmentInstance instance,
            School school,
            List<MarksEntrySubmitDTO> rows,
            MarkStatus targetStatus,
            String actor,
            boolean setSubmittedAt
    ) {
        Integer schoolId = school.getId();
        Integer classGroupId = instance.getClassGroup().getId();

        // Pre-load all valid active student IDs for this class
        java.util.Set<Integer> validStudentIds = studentRepo
                .findBySchool_IdAndClassGroup_IdOrderByLastNameAscFirstNameAsc(schoolId, classGroupId)
                .stream()
                .filter(s -> s.getStatus() == StudentLifecycleStatus.ACTIVE)
                .map(Student::getId)
                .collect(java.util.stream.Collectors.toSet());

        // Pre-load existing marks for fast lookup
        Map<Integer, StudentAssessmentMark> existingByStudentId = markRepo
                .findAllByInstance(instance.getId())
                .stream()
                .collect(Collectors.toMap(m -> m.getStudent().getId(), Function.identity()));

        List<StudentAssessmentMark> toSave = new ArrayList<>();

        for (MarksEntrySubmitDTO row : rows) {
            if (row.studentId() == null) continue;

            // Student must belong to assessment's classGroup
            if (!validStudentIds.contains(row.studentId())) {
                throw new IllegalArgumentException("Student " + row.studentId() + " does not belong to the assessment class group");
            }

            // Validate marks
            BigDecimal marks = row.marksObtained();
            if (marks != null) {
                if (marks.compareTo(BigDecimal.ZERO) < 0) {
                    throw new IllegalArgumentException("Marks cannot be negative for student " + row.studentId());
                }
                if (marks.compareTo(instance.getMaxMarks()) > 0) {
                    throw new IllegalArgumentException(
                            "Marks " + marks + " exceed max marks " + instance.getMaxMarks() + " for student " + row.studentId());
                }
            }

            StudentAssessmentMark mark = existingByStudentId.get(row.studentId());
            if (mark == null) {
                mark = new StudentAssessmentMark();
                mark.setSchool(school);
                mark.setAssessmentInstance(instance);
                Student student = studentRepo.findById(row.studentId())
                        .orElseThrow(() -> new NoSuchElementException("Student not found: " + row.studentId()));
                mark.setStudent(student);
            }

            // Guard locked marks
            if (mark.getStatus() == MarkStatus.LOCKED) {
                throw new IllegalStateException("Mark for student " + row.studentId() + " is locked and cannot be edited");
            }

            mark.setMarksObtained(row.absent() ? null : marks);
            mark.setAbsent(row.absent());
            mark.setAbsentReason(row.absentReason());
            mark.setRemarks(row.remarks());
            mark.setStatus(targetStatus);
            mark.setEnteredBy(actor);
            if (setSubmittedAt && targetStatus == MarkStatus.SUBMITTED) {
                mark.setSubmittedAt(Instant.now());
            }

            toSave.add(mark);
        }

        markRepo.saveAll(toSave);
    }

    private MarksEntryRowDTO toRowDTO(Student student, StudentAssessmentMark mark) {
        String fullName = buildFullName(student);
        if (mark == null) {
            return new MarksEntryRowDTO(
                    student.getId(), student.getAdmissionNo(), fullName,
                    null, null, false, null, null, null);
        }
        return new MarksEntryRowDTO(
                student.getId(), student.getAdmissionNo(), fullName,
                mark.getId(),
                mark.getMarksObtained(),
                mark.isAbsent(),
                mark.getAbsentReason(),
                mark.getRemarks(),
                mark.getStatus()
        );
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

    private void requireMarksEntryOpen(AssessmentInstance instance) {
        if (instance.getStatus() != AssessmentInstanceStatus.MARKS_ENTRY_OPEN) {
            throw new IllegalStateException(
                    "Marks entry is not open for this assessment. Current status: " + instance.getStatus());
        }
    }

    private AssessmentInstance requireInstance(Integer instanceId, Integer schoolId) {
        return instanceRepo.findByIdAndSchool_Id(instanceId, schoolId)
                .orElseThrow(() -> new NoSuchElementException("Assessment instance not found"));
    }

    private School requireSchool(Integer schoolId) {
        return schoolRepo.findById(schoolId)
                .orElseThrow(() -> new NoSuchElementException("School not found"));
    }

    private Integer requireSchoolId() {
        Integer id = TenantContext.getTenantId();
        if (id == null) throw new IllegalStateException("Missing school context");
        return id;
    }

    private String resolveActor() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : "system";
    }
}

