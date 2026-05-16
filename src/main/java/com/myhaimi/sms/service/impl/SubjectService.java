package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.academic.SubjectAllocationVenueParsing;
import com.myhaimi.sms.entity.RoomType;
import com.myhaimi.sms.entity.School;
import com.myhaimi.sms.entity.Subject;
import com.myhaimi.sms.entity.SubjectAllocationVenueRequirement;
import com.myhaimi.sms.DTO.SubjectDeleteInfoDTO;
import com.myhaimi.sms.DTO.SubjectUpdateDTO;
import com.myhaimi.sms.repository.ClassGroupRepo;
import com.myhaimi.sms.repository.ClassSubjectConfigRepo;
import com.myhaimi.sms.repository.SubjectClassGroupRepo;
import com.myhaimi.sms.repository.SchoolRepo;
import com.myhaimi.sms.repository.SubjectRepo;
import com.myhaimi.sms.repository.SubjectAllocationRepo;
import com.myhaimi.sms.repository.TimetableEntryRepo;
import com.myhaimi.sms.repository.StaffTeachableSubjectRepository;
import com.myhaimi.sms.repository.SubjectSectionOverrideRepo;
import com.myhaimi.sms.repository.SubjectClassMappingRepo;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.Authentication;

import java.util.LinkedHashSet;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SubjectService {
    private final SubjectRepo subjectRepo;
    private final SchoolRepo schoolRepo;
    private final SubjectClassGroupRepo subjectClassGroupRepo;
    private final ClassGroupRepo classGroupRepo;
    private final ClassSubjectConfigRepo classSubjectConfigRepo;
    private final SubjectAllocationRepo subjectAllocationRepo;
    private final TimetableEntryRepo timetableEntryRepo;
    private final StaffTeachableSubjectRepository staffTeachableSubjectRepository;
    private final SubjectSectionOverrideRepo subjectSectionOverrideRepo;
    private final SubjectClassMappingRepo subjectClassMappingRepo;

    private Integer requireSchoolId() {
        Integer schoolId = TenantContext.getSchoolId();
        if (schoolId == null) throw new IllegalStateException("Missing school context");
        return schoolId;
    }

    private String actorEmailOrSystem() {
        try {
            Authentication a = SecurityContextHolder.getContext().getAuthentication();
            String name = a == null ? null : a.getName();
            if (name == null || name.isBlank()) return "system";
            return name.trim();
        } catch (Exception ignored) {
            return "system";
        }
    }

    public Page<Subject> list(Pageable pageable) {
        return subjectRepo.findBySchool_IdAndIsDeletedFalse(requireSchoolId(), pageable);
    }

    public List<Subject> listForClassGroup(Integer classGroupId) {
        Integer schoolId = requireSchoolId();
        classGroupRepo.findByIdAndSchool_Id(classGroupId, schoolId).orElseThrow();
        List<Integer> ids = subjectClassGroupRepo.findSubjectIdsByClassGroup_Id(classGroupId);
        if (ids.isEmpty()) return List.of();
        // preserve stable order by subject code (best-effort) while avoiding duplicates
        LinkedHashSet<Integer> set = new LinkedHashSet<>(ids);
        return subjectRepo.findAllById(set).stream()
                .filter(s -> s.getSchool() != null && schoolId.equals(s.getSchool().getId()))
                .sorted((a, b) -> String.valueOf(a.getCode()).compareToIgnoreCase(String.valueOf(b.getCode())))
                .toList();
    }

    @Transactional
    public Subject create(Subject subject) {
        Integer schoolId = requireSchoolId();
        School school = schoolRepo.findById(schoolId).orElseThrow();

        String code = subject.getCode() == null ? "" : subject.getCode().trim().toUpperCase();

        // Check if a previously soft-deleted subject with the same code exists.
        // If so, resurrect it (update fields) instead of inserting a new row, which
        // would violate the unique constraint on (school_id, code).
        Subject existing = subjectRepo.findBySchool_IdAndCode(schoolId, code).orElse(null);
        if (existing != null && existing.isDeleted()) {
            // Resurrect: restore all user-supplied fields and clear the deleted flag.
            existing.setDeleted(false);
            existing.setName(subject.getName() == null ? existing.getName() : subject.getName().trim());
            existing.setCode(code);
            if (subject.getType() != null) existing.setType(subject.getType());
            if (subject.getAllocationVenueRequirement() != null)
                existing.setAllocationVenueRequirement(subject.getAllocationVenueRequirement());
            else
                existing.setAllocationVenueRequirement(SubjectAllocationVenueRequirement.STANDARD_CLASSROOM);
            existing.setSpecializedVenueType(subject.getSpecializedVenueType());
            if (subject.getWeeklyFrequency() != null) existing.setWeeklyFrequency(subject.getWeeklyFrequency());
            String actor = actorEmailOrSystem();
            existing.setUpdatedBy(actor);
            return subjectRepo.save(existing);
        }

        if (existing != null) {
            // Active subject with same code already exists.
            throw new IllegalArgumentException("A subject with code '" + code + "' already exists.");
        }

        subject.setId(null);
        subject.setSchool(school);
        subject.setCode(code);
        if (subject.getAllocationVenueRequirement() == null) {
            subject.setAllocationVenueRequirement(SubjectAllocationVenueRequirement.STANDARD_CLASSROOM);
        }
        String actor = actorEmailOrSystem();
        subject.setCreatedBy(actor);
        subject.setUpdatedBy(actor);
        return subjectRepo.save(subject);
    }

    @Transactional
    public Subject update(Integer subjectId, SubjectUpdateDTO dto) {
        Integer schoolId = requireSchoolId();
        Subject subj = subjectRepo
                .findById(subjectId)
                .filter(s -> s.getSchool() != null && schoolId.equals(s.getSchool().getId()) && !s.isDeleted())
                .orElseThrow();

        String name = dto.name() == null ? "" : dto.name().trim();
        if (name.isEmpty()) {
            throw new IllegalArgumentException("Subject name is required.");
        }
        String code = normalizeSubjectCode(dto.code());
        if (code.length() < 3 || code.length() > 32 || !code.matches("[A-Z0-9]+")) {
            throw new IllegalArgumentException("Subject code must be 3–32 uppercase letters or digits (A–Z, 0–9) only.");
        }
        if (!code.equals(subj.getCode())) {
            subjectRepo
                    .findBySchool_IdAndCode(schoolId, code)
                    .filter(s -> !s.isDeleted() && !s.getId().equals(subj.getId()))
                    .ifPresent(
                            other -> {
                                throw new IllegalArgumentException(
                                        "Another subject already uses code " + code + " (id=" + other.getId() + ").");
                            });
        }
        subj.setName(name);
        subj.setCode(code);
        Integer wf = dto.weeklyFrequency();
        if (wf != null) {
            if (wf <= 0) throw new IllegalArgumentException("weeklyFrequency must be positive.");
            subj.setWeeklyFrequency(wf);
        }
        // Null/blank/invalid in the DTO means standard classroom (never leave venue ambiguous).
        subj.setAllocationVenueRequirement(SubjectAllocationVenueParsing.parseRequirement(dto.allocationVenueRequirement()));
        if (subj.getAllocationVenueRequirement() != SubjectAllocationVenueRequirement.SPECIALIZED_ROOM) {
            subj.setSpecializedVenueType(null);
        } else if (dto.specializedVenueType() != null) {
            String sv = dto.specializedVenueType().trim();
            if (sv.isEmpty()) {
                subj.setSpecializedVenueType(null);
            } else {
                try {
                    subj.setSpecializedVenueType(RoomType.valueOf(sv.toUpperCase()));
                } catch (IllegalArgumentException e) {
                    throw new IllegalArgumentException("Invalid specializedVenueType: " + sv);
                }
            }
        }
        subj.setUpdatedBy(actorEmailOrSystem());
        return subjectRepo.save(subj);
    }

    private static String normalizeSubjectCode(String raw) {
        if (raw == null) {
            return "";
        }
        return raw.trim().toUpperCase();
    }

    @Transactional(readOnly = true)
    public SubjectDeleteInfoDTO deleteInfo(Integer subjectId) {
        Integer schoolId = requireSchoolId();
        Subject subj = subjectRepo.findById(subjectId)
                .filter(s -> s.getSchool() != null && schoolId.equals(s.getSchool().getId()))
                .orElseThrow();

        long allocCount = subjectAllocationRepo.countBySchool_IdAndSubject_Id(schoolId, subj.getId());
        long ttCount = timetableEntryRepo.countBySchool_IdAndSubject_Id(schoolId, subj.getId());

        java.util.List<String> reasons = new java.util.ArrayList<>();
        if (allocCount > 0) reasons.add("Used in academic structure (allocations).");
        if (ttCount > 0) reasons.add("Used in timetable entries.");
        return new SubjectDeleteInfoDTO(reasons.isEmpty(), reasons);
    }

    @Transactional
    public void delete(Integer subjectId) {
        Integer schoolId = requireSchoolId();
        Subject subj = subjectRepo.findById(subjectId)
                .filter(s -> s.getSchool() != null && schoolId.equals(s.getSchool().getId()))
                .orElseThrow();

        SubjectDeleteInfoDTO info = deleteInfo(subjectId);
        if (!info.canDelete()) {
            throw new IllegalStateException("Cannot delete subject. " + String.join(" ", info.reasons()));
        }

        // Clean materialized / legacy mapping data for this subject.
        // IMPORTANT: also remove "class defaults" template mappings so they don't reappear if subject is re-added later.
        classSubjectConfigRepo.deleteBySchool_IdAndSubject_Id(schoolId, subj.getId());
        subjectClassGroupRepo.deleteBySubject_Id(subj.getId());
        subjectSectionOverrideRepo.deleteBySubject_Id(subj.getId());
        subjectClassMappingRepo.deleteBySubject_Id(subj.getId());
        staffTeachableSubjectRepository.deleteBySubject_Id(subj.getId());

        // Soft delete (actual purge is done by super-admin cleanup).
        subj.setDeleted(true);
        subj.setUpdatedBy(actorEmailOrSystem());
        subjectRepo.save(subj);
    }

    @Transactional
    public void deleteAllForSchool() {
        Integer schoolId = requireSchoolId();
        List<Subject> subjects = subjectRepo.findBySchool_IdAndIsDeletedFalseOrderByCodeAsc(schoolId);
        if (subjects.isEmpty()) return;

        // Validate first so we either delete all or none.
        java.util.List<String> blocked = new java.util.ArrayList<>();
        for (Subject s : subjects) {
            SubjectDeleteInfoDTO info = deleteInfo(s.getId());
            if (!info.canDelete()) {
                String reasons = info.reasons() == null || info.reasons().isEmpty() ? "In use." : String.join(" ", info.reasons());
                blocked.add(s.getCode() + " — " + reasons);
            }
        }
        if (!blocked.isEmpty()) {
            throw new IllegalStateException("Cannot delete all subjects. Blocked: " + String.join(" | ", blocked));
        }

        for (Subject s : subjects) {
            delete(s.getId());
        }
    }
}

