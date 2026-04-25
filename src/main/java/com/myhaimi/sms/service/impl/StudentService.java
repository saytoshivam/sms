package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.StudentCreateDTO;
import com.myhaimi.sms.DTO.StudentViewDTO;
import com.myhaimi.sms.entity.ClassGroup;
import com.myhaimi.sms.entity.School;
import com.myhaimi.sms.entity.Student;
import com.myhaimi.sms.repository.ClassGroupRepo;
import com.myhaimi.sms.repository.SchoolRepo;
import com.myhaimi.sms.repository.StudentRepo;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class StudentService {
    private final StudentRepo studentRepo;
    private final SchoolRepo schoolRepo;
    private final ClassGroupRepo classGroupRepo;

    private Integer requireSchoolId() {
        Integer schoolId = TenantContext.getSchoolId();
        if (schoolId == null) throw new IllegalStateException("Missing school context");
        return schoolId;
    }

    public Page<StudentViewDTO> list(Pageable pageable) {
        Integer schoolId = requireSchoolId();
        return studentRepo.findBySchool_Id(schoolId, pageable).map(this::toView);
    }

    public StudentViewDTO create(StudentCreateDTO dto) {
        Integer schoolId = requireSchoolId();
        School school = schoolRepo.findById(schoolId).orElseThrow();

        Student s = new Student();
        s.setSchool(school);
        s.setAdmissionNo(dto.getAdmissionNo());
        s.setFirstName(dto.getFirstName());
        s.setLastName(dto.getLastName());
        s.setDateOfBirth(dto.getDateOfBirth());
        s.setGender(dto.getGender());
        s.setPhone(dto.getPhone());
        s.setAddress(dto.getAddress());
        if (dto.getPhotoUrl() != null && !dto.getPhotoUrl().isBlank()) {
            s.setPhotoUrl(dto.getPhotoUrl().trim());
        }

        if (dto.getClassGroupId() != null) {
            ClassGroup cg = classGroupRepo.findByIdAndSchool_Id(dto.getClassGroupId(), schoolId).orElseThrow();
            s.setClassGroup(cg);
        }

        return toView(studentRepo.save(s));
    }

    private StudentViewDTO toView(Student s) {
        StudentViewDTO dto = new StudentViewDTO();
        dto.setId(s.getId());
        dto.setAdmissionNo(s.getAdmissionNo());
        dto.setFirstName(s.getFirstName());
        dto.setLastName(s.getLastName());
        dto.setDateOfBirth(s.getDateOfBirth());
        dto.setGender(s.getGender());
        dto.setPhone(s.getPhone());
        dto.setAddress(s.getAddress());
        dto.setPhotoUrl(s.getPhotoUrl());
        dto.setCreatedAt(s.getCreatedAt());
        if (s.getClassGroup() != null) {
            dto.setClassGroupId(s.getClassGroup().getId());
            dto.setClassGroupDisplayName(s.getClassGroup().getDisplayName());
        }
        return dto;
    }
}

