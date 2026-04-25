package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.entity.Guardian;
import com.myhaimi.sms.entity.School;
import com.myhaimi.sms.entity.Student;
import com.myhaimi.sms.repository.GuardianRepo;
import com.myhaimi.sms.repository.SchoolRepo;
import com.myhaimi.sms.repository.StudentRepo;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class GuardianService {
    private final GuardianRepo guardianRepo;
    private final SchoolRepo schoolRepo;
    private final StudentRepo studentRepo;

    private Integer requireSchoolId() {
        Integer schoolId = TenantContext.getSchoolId();
        if (schoolId == null) throw new IllegalStateException("Missing school context");
        return schoolId;
    }

    public Page<Guardian> list(Integer studentId, Pageable pageable) {
        Integer schoolId = requireSchoolId();
        if (studentId == null) return guardianRepo.findBySchool_Id(schoolId, pageable);
        return guardianRepo.findBySchool_IdAndStudent_Id(schoolId, studentId, pageable);
    }

    public Guardian create(Guardian guardian) {
        Integer schoolId = requireSchoolId();
        School school = schoolRepo.findById(schoolId).orElseThrow();
        Student student = studentRepo.findByIdAndSchool_Id(guardian.getStudent().getId(), schoolId).orElseThrow();
        guardian.setId(null);
        guardian.setSchool(school);
        guardian.setStudent(student);
        return guardianRepo.save(guardian);
    }
}

