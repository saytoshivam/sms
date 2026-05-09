package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.student.GuardianStandaloneCreateDTO;
import com.myhaimi.sms.entity.Guardian;
import com.myhaimi.sms.repository.GuardianRepo;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class GuardianService {
    private final GuardianRepo guardianRepo;
    private final StudentService studentService;

    private Integer requireSchoolId() {
        Integer schoolId = TenantContext.getSchoolId();
        if (schoolId == null) throw new IllegalStateException("Missing school context");
        return schoolId;
    }

    public Page<Guardian> list(Integer studentId, Pageable pageable) {
        Integer schoolId = requireSchoolId();
        return guardianRepo.findBySchoolAndOptionalStudentLink(schoolId, studentId, pageable);
    }

    /** REST: persists a guardian and links them to {@link GuardianStandaloneCreateDTO#getStudentId()}. */
    public void create(GuardianStandaloneCreateDTO dto) {
        studentService.linkStandaloneGuardian(dto);
    }
}
