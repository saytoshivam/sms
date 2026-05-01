package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.ClassGroupDTO;
import com.myhaimi.sms.DTO.ClassGroupSectionSummaryDTO;
import com.myhaimi.sms.DTO.ClassTeacherBatchAssignDTO;
import com.myhaimi.sms.DTO.ClassGroupUpdateDTO;
import com.myhaimi.sms.DTO.ClassGroupDeleteSummaryDTO;
import com.myhaimi.sms.entity.ClassGroup;
import com.myhaimi.sms.entity.School;
import com.myhaimi.sms.entity.Staff;
import com.myhaimi.sms.entity.User;
import com.myhaimi.sms.repository.ClassGroupRepo;
import com.myhaimi.sms.repository.ClassSubjectConfigRepo;
import com.myhaimi.sms.repository.SubjectAllocationRepo;
import com.myhaimi.sms.repository.SubjectClassGroupRepo;
import com.myhaimi.sms.repository.SubjectSectionOverrideRepo;
import com.myhaimi.sms.repository.SchoolRepo;
import com.myhaimi.sms.repository.StaffRepo;
import com.myhaimi.sms.repository.StudentRepo;
import com.myhaimi.sms.repository.AttendanceSessionRepo;
import com.myhaimi.sms.repository.LectureRepo;
import com.myhaimi.sms.repository.TimetableEntryRepo;
import com.myhaimi.sms.repository.TimetableSlotRepo;
import com.myhaimi.sms.repository.AnnouncementTargetClassRepo;
import com.myhaimi.sms.repository.UserRepo;
import com.myhaimi.sms.security.RoleNames;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ClassGroupService {
    private final ClassGroupRepo classGroupRepo;
    private final SchoolRepo schoolRepo;
    private final StaffRepo staffRepo;
    private final StudentRepo studentRepo;
    private final SubjectAllocationRepo subjectAllocationRepo;
    private final ClassSubjectConfigRepo classSubjectConfigRepo;
    private final SubjectSectionOverrideRepo subjectSectionOverrideRepo;
    private final SubjectClassGroupRepo subjectClassGroupRepo;
    private final TimetableEntryRepo timetableEntryRepo;
    private final TimetableSlotRepo timetableSlotRepo;
    private final AttendanceSessionRepo attendanceSessionRepo;
    private final LectureRepo lectureRepo;
    private final AnnouncementTargetClassRepo announcementTargetClassRepo;
    private final UserRepo userRepo;

    private Integer requireSchoolId() {
        Integer schoolId = TenantContext.getSchoolId();
        if (schoolId == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "School context is required. Use a school account, or sign out and sign in again so your token includes the school.");
        }
        return schoolId;
    }

    public Page<ClassGroup> list(Pageable pageable) {
        return classGroupRepo.findBySchool_IdAndIsDeletedFalse(requireSchoolId(), pageable);
    }

    @Transactional
    public ClassGroup create(ClassGroupDTO dto) {
        Integer schoolId = requireSchoolId();
        School school = schoolRepo.findById(schoolId).orElseThrow();

        Optional<ClassGroup> existingOpt = classGroupRepo.findByCodeAndSchool_Id(dto.getCode(), schoolId);
        if (existingOpt.isPresent()) {
            ClassGroup existing = existingOpt.get();
            if (existing.isDeleted()) {
                applyClassGroupCreate(existing, school, dto);
                existing.setDeleted(false);
                return classGroupRepo.save(existing);
            }
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "A class with code '" + dto.getCode() + "' already exists.");
        }

        ClassGroup cg = new ClassGroup();
        applyClassGroupCreate(cg, school, dto);
        return classGroupRepo.save(cg);
    }

    private void applyClassGroupCreate(ClassGroup cg, School school, ClassGroupDTO dto) {
        cg.setSchool(school);
        cg.setCode(dto.getCode());
        cg.setDisplayName(dto.getDisplayName());
        cg.setGradeLevel(dto.getGradeLevel());
        String sec = dto.getSection() == null ? null : dto.getSection().trim();
        cg.setSection(sec == null || sec.isEmpty() ? null : sec);
        if (dto.getCapacity() != null && dto.getCapacity() > 0) {
            cg.setCapacity(dto.getCapacity());
        }
    }

    /**
     * Sets the homeroom teacher for daily attendance. Only school owner or principal may change this mapping.
     */
    @Transactional
    public ClassGroup assignClassTeacher(int classGroupId, Integer staffId, String actorEmail) {
        User actor =
                userRepo.findFirstByEmailIgnoreCase(actorEmail.trim()).orElseThrow(() -> new AccessDeniedException(
                        "Actor not found"));
        Integer schoolId = requireSchoolId();
        if (actor.getSchool() == null || !actor.getSchool().getId().equals(schoolId)) {
            throw new AccessDeniedException("Tenant mismatch");
        }
        boolean ok = actor.getRoles().stream()
                .map(r -> r.getName())
                .anyMatch(n -> RoleNames.SCHOOL_ADMIN.equals(n) || RoleNames.PRINCIPAL.equals(n));
        if (!ok) {
            throw new AccessDeniedException("Only school owner or principal can assign class teachers");
        }

        ClassGroup cg = classGroupRepo.findByIdAndSchool_Id(classGroupId, schoolId).orElseThrow();
        if (staffId == null) {
            cg.setClassTeacher(null);
        } else {
            Staff st = staffRepo.findByIdAndSchool_Id(staffId, schoolId).orElseThrow();
            cg.setClassTeacher(st);
        }
        return classGroupRepo.save(cg);
    }

    @Transactional(readOnly = true)
    public List<ClassGroupSectionSummaryDTO> listSectionsSummary() {
        Integer schoolId = requireSchoolId();
        List<ClassGroup> groups = classGroupRepo.findAllBySchool_IdAndIsDeletedFalseOrderByGradeLevelAscCodeAsc(schoolId);
        Map<Integer, Long> counts = new HashMap<>();
        for (Object[] row : studentRepo.countStudentsGroupedByClassGroup(schoolId)) {
            if (row == null || row.length < 2) continue;
            Integer classGroupId = row[0] instanceof Integer ? (Integer) row[0] : null;
            Long c = row[1] instanceof Long ? (Long) row[1] : null;
            if (classGroupId != null && c != null) counts.put(classGroupId, c);
        }
        return groups.stream()
                .map(cg -> new ClassGroupSectionSummaryDTO(
                        cg.getId(),
                        cg.getCode(),
                        cg.getDisplayName(),
                        cg.getGradeLevel(),
                        cg.getSection(),
                        cg.getClassTeacherStaffId(),
                        cg.getClassTeacherDisplayName(),
                        counts.getOrDefault(cg.getId(), 0L)
                ))
                .toList();
    }

    @Transactional
    public void assignClassTeachersBatch(ClassTeacherBatchAssignDTO body, String actorEmail) {
        if (body == null || body.items() == null) throw new IllegalArgumentException("items is required");
        User actor =
                userRepo.findFirstByEmailIgnoreCase(actorEmail.trim()).orElseThrow(() -> new AccessDeniedException(
                        "Actor not found"));
        Integer schoolId = requireSchoolId();
        if (actor.getSchool() == null || !actor.getSchool().getId().equals(schoolId)) {
            throw new AccessDeniedException("Tenant mismatch");
        }
        boolean ok = actor.getRoles().stream()
                .map(r -> r.getName())
                .anyMatch(n -> RoleNames.SCHOOL_ADMIN.equals(n) || RoleNames.PRINCIPAL.equals(n));
        if (!ok) {
            throw new AccessDeniedException("Only school owner or principal can assign class teachers");
        }
        for (ClassTeacherBatchAssignDTO.Item it : body.items()) {
            if (it == null) continue;
            ClassGroup cg = classGroupRepo.findByIdAndSchool_Id(it.classGroupId(), schoolId).orElseThrow();
            if (it.staffId() == null) {
                cg.setClassTeacher(null);
            } else {
                Staff st = staffRepo.findByIdAndSchool_Id(it.staffId(), schoolId).orElseThrow();
                cg.setClassTeacher(st);
            }
            classGroupRepo.save(cg);
        }
    }

    @Transactional
    public void deleteAllForSchool(String actorEmail) {
        User actor =
                userRepo.findFirstByEmailIgnoreCase(actorEmail.trim()).orElseThrow(() -> new AccessDeniedException(
                        "Actor not found"));
        Integer schoolId = requireSchoolId();
        if (actor.getSchool() == null || !actor.getSchool().getId().equals(schoolId)) {
            throw new AccessDeniedException("Tenant mismatch");
        }
        boolean ok = actor.getRoles().stream()
                .map(r -> r.getName())
                .anyMatch(n -> RoleNames.SCHOOL_ADMIN.equals(n) || RoleNames.PRINCIPAL.equals(n));
        if (!ok) {
            throw new AccessDeniedException("Only school owner or principal can delete all classes");
        }

        // Dependent data first (FKs point to class groups).
        announcementTargetClassRepo.deleteBySchool_Id(schoolId);
        timetableEntryRepo.deleteBySchool_Id(schoolId);
        timetableSlotRepo.deleteBySchool_Id(schoolId);
        attendanceSessionRepo.deleteBySchool_Id(schoolId);
        lectureRepo.deleteBySchool_Id(schoolId);

        subjectAllocationRepo.deleteBySchool_Id(schoolId);
        subjectSectionOverrideRepo.deleteBySubjectSchool_Id(schoolId);
        subjectClassGroupRepo.deleteBySubjectSchool_Id(schoolId);
        classSubjectConfigRepo.deleteBySchool_Id(schoolId);

        // Students reference class_group_id; remove them as they are fully dependent on class structure here.
        studentRepo.deleteBySchool_Id(schoolId);

        // Soft delete class groups.
        List<ClassGroup> groups = classGroupRepo.findAllBySchool_IdAndIsDeletedFalseOrderByGradeLevelAscCodeAsc(schoolId);
        for (ClassGroup cg : groups) {
            cg.setDeleted(true);
            cg.setUpdatedBy(actorEmail == null || actorEmail.isBlank() ? "system" : actorEmail.trim());
            classGroupRepo.save(cg);
        }
    }

    @Transactional
    public ClassGroup update(int classGroupId, ClassGroupUpdateDTO dto, String actorEmail) {
        User actor =
                userRepo.findFirstByEmailIgnoreCase(actorEmail.trim()).orElseThrow(() -> new AccessDeniedException(
                        "Actor not found"));
        Integer schoolId = requireSchoolId();
        if (actor.getSchool() == null || !actor.getSchool().getId().equals(schoolId)) {
            throw new AccessDeniedException("Tenant mismatch");
        }
        boolean ok = actor.getRoles().stream()
                .map(r -> r.getName())
                .anyMatch(n -> RoleNames.SCHOOL_ADMIN.equals(n) || RoleNames.PRINCIPAL.equals(n));
        if (!ok) {
            throw new AccessDeniedException("Only school owner or principal can edit classes");
        }

        ClassGroup cg = classGroupRepo.findByIdAndSchool_Id(classGroupId, schoolId).orElseThrow();
        cg.setCode(dto.code());
        cg.setDisplayName(dto.displayName());
        cg.setGradeLevel(dto.gradeLevel());
        cg.setSection(dto.section());
        cg.setCapacity(dto.capacity());
        cg.setUpdatedBy(actorEmail == null || actorEmail.isBlank() ? "system" : actorEmail.trim());
        return classGroupRepo.save(cg);
    }

    @Transactional
    public ClassGroupDeleteSummaryDTO deleteOne(int classGroupId, String actorEmail) {
        User actor =
                userRepo.findFirstByEmailIgnoreCase(actorEmail.trim()).orElseThrow(() -> new AccessDeniedException(
                        "Actor not found"));
        Integer schoolId = requireSchoolId();
        if (actor.getSchool() == null || !actor.getSchool().getId().equals(schoolId)) {
            throw new AccessDeniedException("Tenant mismatch");
        }
        boolean ok = actor.getRoles().stream()
                .map(r -> r.getName())
                .anyMatch(n -> RoleNames.SCHOOL_ADMIN.equals(n) || RoleNames.PRINCIPAL.equals(n));
        if (!ok) {
            throw new AccessDeniedException("Only school owner or principal can delete classes");
        }

        ClassGroup cg = classGroupRepo.findByIdAndSchool_Id(classGroupId, schoolId).orElseThrow();

        int announcementTargetsDeleted = announcementTargetClassRepo.deleteBySchool_IdAndClassGroup_Id(schoolId, classGroupId);
        int timetableEntriesDeleted = timetableEntryRepo.deleteBySchool_IdAndClassGroup_Id(schoolId, classGroupId);
        int attendanceSessionsDeleted = attendanceSessionRepo.deleteBySchool_IdAndClassGroup_Id(schoolId, classGroupId);
        int lecturesDeleted = lectureRepo.deleteBySchool_IdAndClassGroup_Id(schoolId, classGroupId);

        int subjectAllocationsDeleted = subjectAllocationRepo.deleteBySchool_IdAndClassGroup_Id(schoolId, classGroupId);
        int subjectSectionOverridesDeleted = subjectSectionOverrideRepo.deleteBySchool_IdAndClassGroup_Id(schoolId, classGroupId);
        int subjectClassMappingsDeleted = subjectClassGroupRepo.deleteBySchool_IdAndClassGroup_Id(schoolId, classGroupId);
        int studentsDeleted = studentRepo.deleteBySchool_IdAndClassGroup_Id(schoolId, classGroupId);

        cg.setDeleted(true);
        cg.setUpdatedBy(actorEmail == null || actorEmail.isBlank() ? "system" : actorEmail.trim());
        classGroupRepo.save(cg);

        // Note: ClassSubjectConfig is grade-scoped (not section-scoped), so we don't delete it here.
        return new ClassGroupDeleteSummaryDTO(
                1,
                studentsDeleted,
                subjectAllocationsDeleted,
                0,
                subjectSectionOverridesDeleted,
                subjectClassMappingsDeleted,
                timetableEntriesDeleted,
                attendanceSessionsDeleted,
                lecturesDeleted,
                announcementTargetsDeleted
        );
    }
}

