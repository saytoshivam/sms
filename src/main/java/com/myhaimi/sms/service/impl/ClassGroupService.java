package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.ClassGroupDTO;
import com.myhaimi.sms.DTO.ClassGroupSectionSummaryDTO;
import com.myhaimi.sms.DTO.ClassTeacherBatchAssignDTO;
import com.myhaimi.sms.entity.ClassGroup;
import com.myhaimi.sms.entity.School;
import com.myhaimi.sms.entity.Staff;
import com.myhaimi.sms.entity.User;
import com.myhaimi.sms.repository.ClassGroupRepo;
import com.myhaimi.sms.repository.SchoolRepo;
import com.myhaimi.sms.repository.StaffRepo;
import com.myhaimi.sms.repository.StudentRepo;
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

    public ClassGroup create(ClassGroupDTO dto) {
        Integer schoolId = requireSchoolId();
        School school = schoolRepo.findById(schoolId).orElseThrow();

        ClassGroup cg = new ClassGroup();
        cg.setSchool(school);
        cg.setCode(dto.getCode());
        cg.setDisplayName(dto.getDisplayName());
        return classGroupRepo.save(cg);
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
}

